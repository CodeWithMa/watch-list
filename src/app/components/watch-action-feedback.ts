import { signal } from '@angular/core';
import { CollectionConflictError, type MutationResult } from '../services/storage.service';

/** Component-local feedback and duplicate protection for settled watch commands. */
export class WatchActionFeedback {
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly sessionSuccess = signal(false);

  async run(operation: () => Promise<MutationResult<unknown>>, failureMessage: string) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.sessionSuccess.set(false);
    try {
      const result = await operation();
      this.sessionSuccess.set(result.durability === 'session-only');
    } catch (error) {
      this.error.set(
        error instanceof CollectionConflictError
          ? error.message
          : `${failureMessage} Please try again.`,
      );
    } finally {
      this.busy.set(false);
    }
  }
}
