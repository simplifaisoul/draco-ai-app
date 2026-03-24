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
  dragon: {
    name: 'Dragon',
    priceId: null as string | null,
    price: 33,
    limits: {
      messagesPerDay: Infinity,
      imagesPerDay: 100,
      maxContainers: 3,
    },
    features: [
      '3 Linux VMs (simultaneous)',
      'SSH into any container',
      'Use as jump boxes',
      'Unlimited AI messages',
      '100 images / day',
      'Priority speed',
      'Everything in Pro',
    ],
  },
} as const;

export type PlanType = keyof typeof PLANS;

// Get or create Stripe products and prices
let productsInitialized = false;
let proPriceId: string | null = null;
let dragonPriceId: string | null = null;

export async function ensureStripeProducts() {
  if (productsInitialized && proPriceId && dragonPriceId) {
    return { proPriceId, dragonPriceId };
  }

  const s = getStripe();

  const products = await s.products.list({ active: true, limit: 100 });

  let proProduct = products.data.find(p => p.metadata.plan === 'pro');
  let dragonProduct = products.data.find(p => p.metadata.plan === 'dragon') || products.data.find(p => p.metadata.plan === 'hacker') || products.data.find(p => p.metadata.plan === 'team');

  if (!proProduct) {
    proProduct = await s.products.create({
      name: 'Draco AI Pro',
      description: '1 Linux VM, unlimited AI messages, Draco Agent, full root access & SSH.',
      metadata: { plan: 'pro' },
    });
  }

  if (!dragonProduct) {
    dragonProduct = await s.products.create({
      name: 'Draco AI Dragon',
      description: '3 Linux VMs, SSH jump boxes, unlimited AI, priority speed.',
      metadata: { plan: 'dragon' },
    });
  }

  const prices = await s.prices.list({ active: true, limit: 100 });

  let proPrice = prices.data.find(p => p.product === proProduct!.id && p.recurring?.interval === 'month');
  let dragonPrice = prices.data.find(p => p.product === dragonProduct!.id && p.recurring?.interval === 'month' && p.unit_amount === 3300);

  if (!proPrice) {
    proPrice = await s.prices.create({
      product: proProduct.id,
      unit_amount: 1200,
      currency: 'usd',
      recurring: { interval: 'month' },
    });
  }

  if (!dragonPrice) {
    dragonPrice = await s.prices.create({
      product: dragonProduct.id,
      unit_amount: 3300,
      currency: 'usd',
      recurring: { interval: 'month' },
    });
  }

  proPriceId = proPrice.id;
  dragonPriceId = dragonPrice.id;
  productsInitialized = true;

  return { proPriceId, dragonPriceId };
}
