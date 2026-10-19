import type { CanDeactivateFn } from '@angular/router';
import type { MutationFeedback } from './mutation-feedback';

export function itemMutationFailure(error: unknown, failureMessage: string) {
  const detail = error instanceof Error ? ` ${error.message}` : '';
  return `${failureMessage}${detail} Please try again or return to Items.`;
}

/** Keep draft posters owned by their mounted picker until the command settles. */
export const canLeaveItemForm: CanDeactivateFn<{ mutation: MutationFeedback } | null> = (
  component,
) => !component?.mutation.busy();
