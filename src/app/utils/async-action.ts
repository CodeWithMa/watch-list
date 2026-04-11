import { WritableSignal, signal } from '@angular/core';

export interface AsyncActionState {
  busy: WritableSignal<boolean>;
  error: WritableSignal<string | null>;
}

export interface AsyncActionOptions {
  showError?: boolean;
  onError?: (error: unknown) => void;
}

export function createAsyncAction(): AsyncActionState {
  return {
    busy: signal(false),
    error: signal(null)
  };
}

export function withAsyncAction<F extends (...args: Parameters<F>) => ReturnType<F>>(
  action: F,
  state: AsyncActionState,
  options: AsyncActionOptions = {}
): F {
  const { busy, error } = state;
  const { showError = true, onError } = options;

  return (async (...args: Parameters<F>) => {
    if (busy()) return;
    busy.set(true);
    if (showError) error.set(null);
    try {
      await action(...args);
    } catch (err) {
      if (showError) {
        error.set(err instanceof Error ? err.message : 'Operation failed');
      }
      onError?.(err);
    } finally {
      busy.set(false);
    }
  }) as F;
}

export function clearError(error: WritableSignal<string | null>) {
  error.set(null);
}