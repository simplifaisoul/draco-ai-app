import { NextRequest, NextResponse } from 'next/server';

// Server-side rate limiting using Firestore REST API
// No firebase-admin needed — uses the REST API directly with project ID

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

function getTodayKey(): string {
    return new Date().toISOString().split('T')[0];
}

const LIMITS: Record<string, { requests: number; images: number }> = {
    free: { requests: 33, images: 3 },
    pro: { requests: 999999, images: 999999 },
    team: { requests: 999999, images: 999999 },
};

async function getUsageDoc(userId: string, today: string) {
    const docId = `${userId}_${today}`;
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/usage/${docId}`;

    try {
        const res = await fetch(url);
        if (res.status === 404) return null;
        if (!res.ok) return null;
        const data = await res.json();
        return {
            requests: parseInt(data.fields?.requests?.integerValue || '0'),
            images: parseInt(data.fields?.images?.integerValue || '0'),
        };
    } catch {
        return null;
    }
}

async function setUsageDoc(userId: string, today: string, requests: number, images: number) {
    const docId = `${userId}_${today}`;
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/usage/${docId}`;

    await fetch(url + '?updateMask.fieldPaths=requests&updateMask.fieldPaths=images&updateMask.fieldPaths=date&updateMask.fieldPaths=userId', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fields: {
                requests: { integerValue: requests.toString() },
                images: { integerValue: images.toString() },
                date: { stringValue: today },
                userId: { stringValue: userId },
            },
        }),
    });
}

export async function POST(request: NextRequest) {
    try {
        const { userId, action, plan } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        const userPlan = plan || 'free';
        const today = getTodayKey();
        const userLimits = LIMITS[userPlan] || LIMITS.free;

        const doc = await getUsageDoc(userId, today);
        const currentRequests = doc?.requests || 0;
        const currentImages = doc?.images || 0;

        if (action === 'check') {
            return NextResponse.json({
                allowed: currentRequests < userLimits.requests,
                requests: currentRequests,
                images: currentImages,
                limits: userLimits,
                remaining: Math.max(0, userLimits.requests - currentRequests),
                plan: userPlan,
            });
        }

        if (action === 'increment_message') {
            if (currentRequests >= userLimits.requests) {
                return NextResponse.json({
                    allowed: false,
                    error: 'Daily request limit reached',
                    remaining: 0,
                }, { status: 429 });
            }

            await setUsageDoc(userId, today, currentRequests + 1, currentImages);
            return NextResponse.json({
                allowed: true,
                remaining: Math.max(0, userLimits.requests - currentRequests - 1),
            });
        }

        if (action === 'increment_image') {
            if (currentImages >= userLimits.images) {
                return NextResponse.json({
                    allowed: false,
                    error: 'Daily image limit reached',
                    remaining: 0,
                }, { status: 429 });
            }

            await setUsageDoc(userId, today, currentRequests, currentImages + 1);
            return NextResponse.json({
                allowed: true,
                remaining: Math.max(0, userLimits.images - currentImages - 1),
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        console.error('Usage check error:', error);
        // Fail open
        return NextResponse.json({ allowed: true, remaining: 33 });
    }
}
