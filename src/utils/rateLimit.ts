export class RateLimiter {
  private nextAvailableAt = 0;

  constructor(private readonly intervalMs: number) {}

  async wait() {
    const now = Date.now();
    const waitMs = Math.max(0, this.nextAvailableAt - now);
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    this.nextAvailableAt = Date.now() + this.intervalMs;
  }
}
