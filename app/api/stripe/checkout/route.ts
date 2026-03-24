import { NextRequest, NextResponse } from 'next/server';
import { getStripe, ensureStripeProducts } from '@/app/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const { plan, userId, userEmail } = await request.json();

    if (!plan || !userId || !userEmail) {
      return NextResponse.json({ error: 'Missing plan, userId, or userEmail' }, { status: 400 });
    }

    const { proPriceId, dragonPriceId } = await ensureStripeProducts();
    const priceId = plan === 'pro' ? proPriceId : (plan === 'dragon' || plan === 'hacker' || plan === 'team') ? dragonPriceId : null;

    if (!priceId) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Check for existing customer
    const existingCustomers = await getStripe().customers.list({
      email: userEmail,
      limit: 1,
    });

    let customerId = existingCustomers.data[0]?.id;

    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: userEmail,
        metadata: { firebaseUid: userId },
      });
      customerId = customer.id;
    }

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${request.headers.get('origin') || 'https://dracoai.app'}?upgraded=true`,
      cancel_url: `${request.headers.get('origin') || 'https://dracoai.app'}?cancelled=true`,
      metadata: { firebaseUid: userId, plan },
      subscription_data: {
        metadata: { firebaseUid: userId, plan },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
