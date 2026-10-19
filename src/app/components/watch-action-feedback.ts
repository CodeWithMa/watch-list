import { CollectionConflictError } from '../services/storage.service';

export function watchActionFailure(error: unknown, failureMessage: string) {
  return error instanceof CollectionConflictError
    ? error.message
    : `${failureMessage} Please try again.`;
}
