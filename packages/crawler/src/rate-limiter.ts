/**
 * Token-bucket rate limiter with per-minute and per-day limits.
 *
 * - Enforces a minimum interval between requests derived from `perMinute`.
 * - Tracks a daily counter that resets at midnight (local time).
 * - `acquire()` resolves to `true` when the request is allowed (after waiting
 *   for the per-minute interval), or `false` when the daily cap has been hit.
 */
export class RateLimiter {
  private readonly minIntervalMs: number;
  private readonly perDay: number;
  private _dailyCount = 0;
  private lastRequestTime = 0;
  private currentDay: number;

  constructor(opts: { perMinute: number; perDay: number }) {
    this.minIntervalMs = 60_000 / opts.perMinute;
    this.perDay = opts.perDay;
    this.currentDay = this.todayOrdinal();
  }

  /** Number of requests made today. */
  get dailyCount(): number {
    this.checkDayReset();
    return this._dailyCount;
  }

  /** Reset the daily counter if the calendar day has changed. */
  checkDayReset(): void {
    const today = this.todayOrdinal();
    if (today !== this.currentDay) {
      this._dailyCount = 0;
      this.currentDay = today;
    }
  }

  /**
   * Wait for the per-minute interval and then try to consume a token.
   * Returns `true` if the request is allowed, `false` if the daily limit
   * has been reached.
   */
  async acquire(): Promise<boolean> {
    this.checkDayReset();

    if (this._dailyCount >= this.perDay) {
      return false;
    }

    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < this.minIntervalMs) {
      const waitMs = this.minIntervalMs - elapsed;
      await this.sleep(waitMs);
    }

    // Re-check after sleeping — another caller could theoretically have
    // consumed the last token while we were waiting.
    this.checkDayReset();
    if (this._dailyCount >= this.perDay) {
      return false;
    }

    this.lastRequestTime = Date.now();
    this._dailyCount += 1;
    return true;
  }

  // ------- private helpers -------

  private todayOrdinal(): number {
    const d = new Date();
    // Year * 1000 + day-of-year gives a unique integer per calendar day.
    const start = new Date(d.getFullYear(), 0, 0);
    const diff = d.getTime() - start.getTime();
    const oneDay = 86_400_000;
    return d.getFullYear() * 1000 + Math.floor(diff / oneDay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
