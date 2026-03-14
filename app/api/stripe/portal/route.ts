import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/app/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const { userEmail } = await request.json();

    if (!userEmail) {
      return NextResponse.json({ error: 'Missing userEmail' }, { status: 400 });
    }

    const customers = await getStripe().customers.list({
      email: userEmail,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return NextResponse.json({ error: 'No customer found' }, { status: 404 });
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: request.headers.get('origin') || 'https://dracoai.app',
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe portal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
