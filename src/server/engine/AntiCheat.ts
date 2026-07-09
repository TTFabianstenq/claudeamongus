/**
 * Per-connection abuse guards: token-bucket rate limiting per event type,
 * malformed-packet strikes, and duplicate/stale input rejection. Movement
 * itself cannot be spoofed because the server integrates positions from
 * clamped inputs — this class handles everything else.
 */

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export interface RateRule {
  /** tokens added per second */
  perSecond: number;
  /** maximum burst size */
  burst: number;
}

export const RATE_RULES: Record<string, RateRule> = {
  "game:input": { perSecond: 45, burst: 90 },
  "game:kill": { perSecond: 2, burst: 3 },
  "game:report": { perSecond: 2, burst: 3 },
  "game:emergency": { perSecond: 1, burst: 2 },
  "game:ventEnter": { perSecond: 3, burst: 4 },
  "game:ventMove": { perSecond: 4, burst: 6 },
  "game:ventExit": { perSecond: 3, burst: 4 },
  "game:taskOpen": { perSecond: 3, burst: 5 },
  "game:taskComplete": { perSecond: 3, burst: 5 },
  "game:sabotage": { perSecond: 1, burst: 2 },
  "game:doorSabotage": { perSecond: 1, burst: 2 },
  "game:fix": { perSecond: 3, burst: 5 },
  "game:fixHold": { perSecond: 6, burst: 10 },
  "game:fixRelease": { perSecond: 6, burst: 10 },
  "meeting:vote": { perSecond: 2, burst: 3 },
  "chat:send": { perSecond: 1.5, burst: 4 },
  "room:create": { perSecond: 0.2, burst: 2 },
  "room:join": { perSecond: 0.5, burst: 3 },
  "room:rejoin": { perSecond: 0.5, burst: 3 },
  "room:list": { perSecond: 1, burst: 3 },
  "lobby:ready": { perSecond: 3, burst: 6 },
  "lobby:cosmetic": { perSecond: 2, burst: 5 },
  "lobby:settings": { perSecond: 3, burst: 6 },
  "lobby:start": { perSecond: 1, burst: 2 },
};

const DEFAULT_RULE: RateRule = { perSecond: 5, burst: 10 };
export const MAX_STRIKES = 25;

export class AntiCheat {
  private buckets = new Map<string, Bucket>();
  private strikes = 0;

  /** Returns false when the event exceeds its rate budget. */
  allow(event: string, now: number = Date.now()): boolean {
    const rule = RATE_RULES[event] ?? DEFAULT_RULE;
    let bucket = this.buckets.get(event);
    if (!bucket) {
      bucket = { tokens: rule.burst, lastRefill: now };
      this.buckets.set(event, bucket);
    }
    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(rule.burst, bucket.tokens + elapsed * rule.perSecond);
    bucket.lastRefill = now;
    if (bucket.tokens < 1) {
      this.strike();
      return false;
    }
    bucket.tokens -= 1;
    return true;
  }

  /** Records a protocol violation (malformed payload, invalid action). */
  strike(count = 1): void {
    this.strikes += count;
  }

  get shouldKick(): boolean {
    return this.strikes >= MAX_STRIKES;
  }

  get strikeCount(): number {
    return this.strikes;
  }
}
