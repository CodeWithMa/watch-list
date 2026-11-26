import type { CanDeactivateFn } from '@angular/router';
import type { MutationFeedback } from './mutation-feedback';

export function itemMutationFailure(error: unknown, failureMessage: string) {
  const detail = error instanceof Error ? ` ${error.message}` : '';
  return `${failureMessage}${detail} Please try again or return to Items.`;
}

export const canLeaveItemForm: CanDeactivateFn<{ mutation: MutationFeedback } | null> = (
  component,
) => !component?.mutation.busy();
