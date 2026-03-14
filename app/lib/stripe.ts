import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  typescript: true,
});

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
    priceId: null as string | null, // Will be set after product creation
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

  // Search for existing products
  const products = await stripe.products.list({ active: true, limit: 100 });

  let proProduct = products.data.find(p => p.metadata.plan === 'pro');
  let teamProduct = products.data.find(p => p.metadata.plan === 'team');

  // Create Pro product if missing
  if (!proProduct) {
    proProduct = await stripe.products.create({
      name: 'Draco AI Pro',
      description: 'Unlimited messages, 50 images/day, all themes, priority speed',
      metadata: { plan: 'pro' },
    });
  }

  // Create Team product if missing
  if (!teamProduct) {
    teamProduct = await stripe.products.create({
      name: 'Draco AI Team',
      description: 'Everything in Pro + shared workspaces, team memory, priority support',
      metadata: { plan: 'team' },
    });
  }

  // Get or create prices
  const prices = await stripe.prices.list({ active: true, limit: 100 });

  let proPrice = prices.data.find(p => p.product === proProduct!.id && p.recurring?.interval === 'month');
  let teamPrice = prices.data.find(p => p.product === teamProduct!.id && p.recurring?.interval === 'month');

  if (!proPrice) {
    proPrice = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: 1200, // $12.00
      currency: 'usd',
      recurring: { interval: 'month' },
    });
  }

  if (!teamPrice) {
    teamPrice = await stripe.prices.create({
      product: teamProduct.id,
      unit_amount: 2500, // $25.00
      currency: 'usd',
      recurring: { interval: 'month' },
    });
  }

  proPriceId = proPrice.id;
  teamPriceId = teamPrice.id;
  productsInitialized = true;

  return { proPriceId, teamPriceId };
}
