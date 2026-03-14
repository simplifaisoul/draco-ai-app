import { PLANS } from './stripe';

// Server-side usage tracking key format: draco_usage_{userId}_{date}
function getUsageKey(userId: string): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `draco_usage_${userId}_${today}`;
}

// Updated limits: 33 requests/day free, unlimited for paid
const LIMITS = {
  free: { requestsPerDay: 33, imagesPerDay: 3 },
  pro: { requestsPerDay: Infinity, imagesPerDay: Infinity },
  team: { requestsPerDay: Infinity, imagesPerDay: Infinity },
};

// ---------- Client-side tracking (localStorage) ----------

function getClientUsage(): { messages: number; images: number; date: string } {
  if (typeof window === 'undefined') return { messages: 0, images: 0, date: '' };
  const raw = localStorage.getItem('draco_daily_usage');
  if (!raw) return { messages: 0, images: 0, date: new Date().toISOString().split('T')[0] };
  try {
    const data = JSON.parse(raw);
    const today = new Date().toISOString().split('T')[0];
    if (data.date !== today) {
      return { messages: 0, images: 0, date: today };
    }
    return data;
  } catch {
    return { messages: 0, images: 0, date: new Date().toISOString().split('T')[0] };
  }
}

function saveClientUsage(usage: { messages: number; images: number; date: string }) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('draco_daily_usage', JSON.stringify(usage));
}

export function canSendMessage(plan: string): { allowed: boolean; remaining: number } {
  const limits = LIMITS[plan as keyof typeof LIMITS] || LIMITS.free;
  if (limits.requestsPerDay === Infinity) return { allowed: true, remaining: Infinity };
  const usage = getClientUsage();
  const remaining = limits.requestsPerDay - usage.messages;
  return { allowed: remaining > 0, remaining: Math.max(0, remaining) };
}

export function canGenerateImage(plan: string): { allowed: boolean; remaining: number } {
  const limits = LIMITS[plan as keyof typeof LIMITS] || LIMITS.free;
  if (limits.imagesPerDay === Infinity) return { allowed: true, remaining: Infinity };
  const usage = getClientUsage();
  const remaining = limits.imagesPerDay - usage.images;
  return { allowed: remaining > 0, remaining: Math.max(0, remaining) };
}

export function incrementMessages() {
  const usage = getClientUsage();
  usage.messages += 1;
  saveClientUsage(usage);
}

export function incrementImages() {
  const usage = getClientUsage();
  usage.images += 1;
  saveClientUsage(usage);
}

export function getUsageCounts(): { messages: number; images: number } {
  const usage = getClientUsage();
  return { messages: usage.messages, images: usage.images };
}

export function getRemainingRequests(plan: string): number {
  const limits = LIMITS[plan as keyof typeof LIMITS] || LIMITS.free;
  if (limits.requestsPerDay === Infinity) return Infinity;
  const usage = getClientUsage();
  return Math.max(0, limits.requestsPerDay - usage.messages);
}
