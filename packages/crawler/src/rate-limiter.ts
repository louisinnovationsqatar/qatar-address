/**
 * Rate limiter matching QNAS API limits:
 * - IP-level: 3 requests every 5 seconds
 * - Token-level: 60 requests per minute
 *
 * We enforce 1 request per 1.8 seconds (33/min) to stay safely under both limits.
 * Tracks a daily counter for logging purposes (no hard daily cap).
 */
export class RateLimiter {
  private readonly minIntervalMs: number;
  private _dailyCount = 0;
  private lastRequestTime = 0;
  private currentDay: number;

  constructor(opts?: { minIntervalMs?: number }) {
    // Default: 1 request per 1.8 seconds = ~33/min (safely under 36/min IP limit)
    this.minIntervalMs = opts?.minIntervalMs ?? 1800;
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
   * Wait for the minimum interval between requests, then allow.
   * Always returns true (no daily cap — QNAS doesn't enforce one via the API).
   */
  async acquire(): Promise<boolean> {
    this.checkDayReset();

    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < this.minIntervalMs) {
      const waitMs = this.minIntervalMs - elapsed;
      await this.sleep(waitMs);
    }

    this.lastRequestTime = Date.now();
    this._dailyCount += 1;
    return true;
  }

  // ------- private helpers -------

  private todayOrdinal(): number {
    const d = new Date();
    const start = new Date(d.getFullYear(), 0, 0);
    const diff = d.getTime() - start.getTime();
    const oneDay = 86_400_000;
    return d.getFullYear() * 1000 + Math.floor(diff / oneDay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
