import { WritableSignal, signal } from '@angular/core';

export interface ActionMessage {
  text: string;
  type: 'success' | 'error';
}

export interface AsyncActionState {
  busy: WritableSignal<boolean>;
  message: WritableSignal<ActionMessage | null>;
}

export interface AsyncActionOptions {
  showMessage?: boolean;
  onError?: (error: unknown) => void;
}

export function createAsyncAction(): AsyncActionState {
  return {
    busy: signal(false),
    message: signal(null)
  };
}

export function withAsyncAction<F extends (...args: Parameters<F>) => ReturnType<F>>(
  action: F,
  state: AsyncActionState,
  options: AsyncActionOptions = {}
): F {
  const { busy, message } = state;
  const { showMessage = true, onError } = options;

  return (async (...args: Parameters<F>) => {
    if (busy()) return;
    busy.set(true);
    if (showMessage) message.set(null);
    try {
      await action(...args);
    } catch (err) {
      if (showMessage) {
        message.set({
          text: err instanceof Error ? err.message : 'Operation failed',
          type: 'error'
        });
      }
      onError?.(err);
    } finally {
      busy.set(false);
    }
  }) as F;
}

export function clearMessage(message: WritableSignal<ActionMessage | null>) {
  message.set(null);
}
