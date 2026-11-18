/**
 * Runs the first change immediately, then coalesces anything changed while it
 * was running into one final save. `isLatest` lets the worker avoid restoring
 * a completed stale result over the newer optimistic UI state.
 */
export class LatestChangeQueue<T> {
  private pending: { value: T; version: number } | null = null;
  private version = 0;
  private running = false;

  constructor(
    private readonly worker: (value: T, isLatest: () => boolean) => Promise<void>,
    private readonly onError: (error: unknown) => void,
    private readonly onBusy?: (busy: boolean) => void,
  ) {}

  push(value: T): void {
    this.pending = { value, version: ++this.version };
    if (!this.running) void this.flush();
  }

  private async flush(): Promise<void> {
    this.running = true;
    this.onBusy?.(true);
    try {
      while (this.pending) {
        const job = this.pending;
        this.pending = null;
        try {
          await this.worker(job.value, () => this.pending === null && this.version === job.version);
        } catch (error) {
          this.onError(error);
        }
      }
    } finally {
      this.running = false;
      this.onBusy?.(false);
    }
  }
}
