import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      typescript: true,
    });
  }
  return _stripe;
}

// Plan definitions
export const PLANS = {
  free: {
    name: 'Free',
    priceId: null,
    limits: {
      messagesPerDay: 25,
      imagesPerDay: 3,
    },
    features: [
      '25 messages per day',
      '3 AI images per day',
      'Cosmic theme',
      'Basic models',
    ],
  },
  pro: {
    name: 'Pro',
    priceId: null as string | null,
    price: 12,
    limits: {
      messagesPerDay: Infinity,
      imagesPerDay: 50,
    },
    features: [
      'Unlimited messages',
      '50 AI images per day',
      'All 3 themes',
      'Priority speed',
      'Chain of Thought',
      'Memory Vault',
      'File uploads',
    ],
  },
  team: {
    name: 'Team',
    priceId: null as string | null,
    price: 25,
    limits: {
      messagesPerDay: Infinity,
      imagesPerDay: 200,
    },
    features: [
      'Everything in Pro',
      '200 AI images per day',
      'Shared workspaces',
      'Team memory',
      'Custom system prompts',
      'Priority support',
    ],
  },
} as const;

export type PlanType = keyof typeof PLANS;

// Get or create Stripe products and prices
let productsInitialized = false;
let proPriceId: string | null = null;
let teamPriceId: string | null = null;

export async function ensureStripeProducts() {
  if (productsInitialized && proPriceId && teamPriceId) {
    return { proPriceId, teamPriceId };
  }

  const s = getStripe();

  const products = await s.products.list({ active: true, limit: 100 });

  let proProduct = products.data.find(p => p.metadata.plan === 'pro');
  let teamProduct = products.data.find(p => p.metadata.plan === 'team');

  if (!proProduct) {
    proProduct = await s.products.create({
      name: 'Draco AI Pro',
      description: 'Unlimited AI requests, unlimited image generation, all premium themes, priority speed, and advanced reasoning — no daily limits.',
      metadata: { plan: 'pro' },
    });
  }

  if (!teamProduct) {
    teamProduct = await s.products.create({
      name: 'Draco AI Team',
      description: 'Everything in Pro + shared workspaces, team memory, priority support',
      metadata: { plan: 'team' },
    });
  }

  const prices = await s.prices.list({ active: true, limit: 100 });

  let proPrice = prices.data.find(p => p.product === proProduct!.id && p.recurring?.interval === 'month');
  let teamPrice = prices.data.find(p => p.product === teamProduct!.id && p.recurring?.interval === 'month');

  if (!proPrice) {
    proPrice = await s.prices.create({
      product: proProduct.id,
      unit_amount: 1200,
      currency: 'usd',
      recurring: { interval: 'month' },
    });
  }

  if (!teamPrice) {
    teamPrice = await s.prices.create({
      product: teamProduct.id,
      unit_amount: 2500,
      currency: 'usd',
      recurring: { interval: 'month' },
    });
  }

  proPriceId = proPrice.id;
  teamPriceId = teamPrice.id;
  productsInitialized = true;

  return { proPriceId, teamPriceId };
}
