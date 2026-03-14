import { NextRequest, NextResponse } from 'next/server';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'dracoai-b0758';

function generateShareId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 12; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

export async function POST(request: NextRequest) {
    try {
        const { messages, title, userId } = await request.json();

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json({ error: 'No messages to share' }, { status: 400 });
        }

        const shareId = generateShareId();
        const timestamp = new Date().toISOString();

        // Strip base64 images to keep payload small, keep image placeholder
        const cleanMessages = messages
            .filter((m: any) => m.role !== 'system')
            .map((m: any) => ({
                role: m.role,
                content: m.content.replace(/data:image\/[^;]+;base64,[^\)]+/g, 'https://dracoai.app/dragon_final.png'),
                timestamp: m.timestamp || timestamp,
            }));

        // Save to Firestore
        const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/shared_chats/${shareId}`;

        const res = await fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fields: {
                    messages: { stringValue: JSON.stringify(cleanMessages) },
                    title: { stringValue: title || 'Draco AI Chat' },
                    userId: { stringValue: userId || 'anonymous' },
                    createdAt: { stringValue: timestamp },
                    views: { integerValue: '0' },
                },
            }),
        });

        if (!res.ok) {
            console.error('Firestore error:', await res.text());
            return NextResponse.json({ error: 'Failed to save shared chat' }, { status: 500 });
        }

        const origin = request.headers.get('origin') || 'https://dracoai.app';
        const shareUrl = `${origin}/share/${shareId}`;

        return NextResponse.json({ shareId, shareUrl });
    } catch (error: any) {
        console.error('Share error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
