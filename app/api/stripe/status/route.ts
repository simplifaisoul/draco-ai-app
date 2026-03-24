import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/app/lib/stripe';

// Permanently Pro accounts (admins/owners)
const PRO_OVERRIDE_EMAILS = [
  'soulsimplifai@gmail.com',
  'simplifaisoul@gmail.com',
  'sounakabz123@gmail.com',
];

export async function POST(request: NextRequest) {
  try {
    const { userEmail } = await request.json();

    if (!userEmail) {
      return NextResponse.json({ error: 'Missing userEmail' }, { status: 400 });
    }

    // Check for permanent Pro overrides
    if (PRO_OVERRIDE_EMAILS.includes(userEmail.toLowerCase())) {
      return NextResponse.json({ plan: 'pro', status: 'active', override: true });
    }

    const customers = await getStripe().customers.list({
      email: userEmail,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return NextResponse.json({ plan: 'free', status: 'active' });
    }

    const customer = customers.data[0];

    // Check active subscriptions
    const subscriptions = await getStripe().subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      // Check for trialing
      const trialing = await getStripe().subscriptions.list({
        customer: customer.id,
        status: 'trialing',
        limit: 1,
      });

      if (trialing.data.length === 0) {
        return NextResponse.json({ plan: 'free', status: 'inactive' });
      }

      const plan = trialing.data[0].metadata.plan || 'pro';
      return NextResponse.json({ plan, status: 'trialing' });
    }

    const sub = subscriptions.data[0];
    const plan = sub.metadata.plan || 'pro';

    return NextResponse.json({
      plan,
      status: sub.status,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    });
  } catch (error: any) {
    console.error('Stripe status error:', error);
    return NextResponse.json({ plan: 'free', status: 'error' });
  }
}
