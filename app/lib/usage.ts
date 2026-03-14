// Usage tracking for free-tier limits
// Stores daily counts in localStorage (client-side) with server-side verification via Stripe status

const USAGE_KEY = 'draco_usage';

interface DailyUsage {
  date: string; // YYYY-MM-DD
  messages: number;
  images: number;
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getUsage(): DailyUsage {
  if (typeof window === 'undefined') return { date: getToday(), messages: 0, images: 0 };

  try {
    const stored = localStorage.getItem(USAGE_KEY);
    if (stored) {
      const usage = JSON.parse(stored) as DailyUsage;
      // Reset if it's a new day
      if (usage.date !== getToday()) {
        const fresh = { date: getToday(), messages: 0, images: 0 };
        localStorage.setItem(USAGE_KEY, JSON.stringify(fresh));
        return fresh;
      }
      return usage;
    }
  } catch { /* ignore */ }

  const fresh = { date: getToday(), messages: 0, images: 0 };
  localStorage.setItem(USAGE_KEY, JSON.stringify(fresh));
  return fresh;
}

function saveUsage(usage: DailyUsage): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
}

export function incrementMessages(): DailyUsage {
  const usage = getUsage();
  usage.messages += 1;
  saveUsage(usage);
  return usage;
}

export function incrementImages(): DailyUsage {
  const usage = getUsage();
  usage.images += 1;
  saveUsage(usage);
  return usage;
}

export function getMessageCount(): number {
  return getUsage().messages;
}

export function getImageCount(): number {
  return getUsage().images;
}

export function canSendMessage(plan: string): { allowed: boolean; remaining: number } {
  if (plan === 'pro' || plan === 'team') return { allowed: true, remaining: Infinity };
  const count = getMessageCount();
  const limit = 25;
  return { allowed: count < limit, remaining: Math.max(0, limit - count) };
}

export function canGenerateImage(plan: string): { allowed: boolean; remaining: number } {
  if (plan === 'team') return { allowed: true, remaining: 200 - getImageCount() };
  if (plan === 'pro') return { allowed: true, remaining: 50 - getImageCount() };
  const count = getImageCount();
  const limit = 3;
  return { allowed: count < limit, remaining: Math.max(0, limit - count) };
}
