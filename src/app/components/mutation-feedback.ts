import { signal } from '@angular/core';
import type { MutationResult } from '../services/storage.service';

/** One settled command at a time; callers own wording and post-success interaction. */
export class MutationFeedback {
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly sessionSuccess = signal(false);

  constructor(private readonly describeFailure: (error: unknown, action: string) => string) {}

  /** Unlocks before returning success; rejected and duplicate attempts return undefined. */
  async run<T>(operation: () => Promise<MutationResult<T>>, action: string) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.sessionSuccess.set(false);
    try {
      const result = await operation();
      this.sessionSuccess.set(result.durability === 'session-only');
      return result;
    } catch (error) {
      this.error.set(this.describeFailure(error, action));
      return undefined;
    } finally {
      this.busy.set(false);
    }
  }
}
