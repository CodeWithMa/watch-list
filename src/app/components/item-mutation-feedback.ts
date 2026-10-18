import { signal } from '@angular/core';
import type { CanDeactivateFn } from '@angular/router';
import type { MutationResult } from '../services/storage.service';

/** One in-flight form command, retaining the draft on rejection. */
export class ItemMutationFeedback {
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  async run<T>(operation: () => Promise<MutationResult<T>>, failureMessage: string) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      return await operation();
    } catch (error) {
      const detail = error instanceof Error ? ` ${error.message}` : '';
      this.error.set(`${failureMessage}${detail} Please try again or return to Items.`);
      return undefined;
    } finally {
      this.busy.set(false);
    }
  }
}

/** Keep draft posters owned by their mounted picker until the command settles. */
export const canLeaveItemForm: CanDeactivateFn<{ mutation: ItemMutationFeedback } | null> = (
  component,
) => !component?.mutation.busy();
