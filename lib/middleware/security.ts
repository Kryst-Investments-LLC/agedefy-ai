interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class InMemoryRateLimit {
  private store = new Map<string, RateLimitEntry>();
  private readonly windowMs = 15 * 60 * 1000;
  private readonly maxRequests = 100;

  isRateLimited(identifier: string): boolean {
    const now = Date.now();
    const entry = this.store.get(identifier);

    if (!entry || now > entry.resetTime) {
      this.store.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs
      });
      return false;
    }

    if (entry.count >= this.maxRequests) {
      return true;
    }

    entry.count++;
    return false;
  }

  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

export const rateLimiter = new InMemoryRateLimit();

setInterval(() => {
  rateLimiter.cleanup();
}, 5 * 60 * 1000);

export const getClientIdentifier = (request: Request): string => {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const remoteAddr = forwarded?.split(',')[0] || realIp || 'unknown';
  return remoteAddr;
};

export const sanitizeInput = (input: string): string => {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
};
