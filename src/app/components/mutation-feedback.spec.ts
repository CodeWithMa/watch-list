import { vi } from 'vitest';
import type { MutationResult } from '../services/storage.service';
import { MutationFeedback } from './mutation-feedback';

describe('Settled mutation feedback', () => {
  it('locks until settlement, suppresses duplicate execution, and returns the committed result after unlocking', async () => {
    const feedback = new MutationFeedback(() => 'Unable to change.');
    let complete!: (result: MutationResult<{ id: string }>) => void;
    const operation = vi.fn(
      () => new Promise<MutationResult<{ id: string }>>((resolve) => (complete = resolve)),
    );

    const pending = feedback.run(operation, 'change');
    expect(feedback.busy()).toBe(true);
    expect(feedback.error()).toBeNull();
    expect(feedback.sessionSuccess()).toBe(false);
    await expect(feedback.run(operation, 'change')).resolves.toBeUndefined();
    expect(operation).toHaveBeenCalledTimes(1);
    const competingOperation = vi.fn();
    await expect(feedback.run(competingOperation, 'delete')).resolves.toBeUndefined();
    expect(competingOperation).not.toHaveBeenCalled();
    expect(feedback.busy()).toBe(true);

    const committed = { value: { id: 'created-item' }, durability: 'persistent' } as const;
    complete(committed);
    const result = await pending;
    expect(feedback.busy()).toBe(false);
    expect(result).toBe(committed);
    expect(result?.value.id).toBe('created-item');
    expect(feedback.error()).toBeNull();
    expect(feedback.sessionSuccess()).toBe(false);
  });

  it.each(['asynchronous rejection', 'synchronous failure', 'non-Error rejection'] as const)(
    'unlocks after %s, explains the failure, and clears the error as retry starts',
    async (failure) => {
      const error =
        failure === 'non-Error rejection' ? { code: 'unavailable' } : new Error('Disk full');
      const describeFailure = vi.fn(() => 'Unable to save. Please retry.');
      const feedback = new MutationFeedback(describeFailure);
      let reject!: (error: unknown) => void;
      const failed = feedback.run(() => {
        if (failure === 'synchronous failure') throw error;
        return new Promise<MutationResult<void>>(
          (_, rejectOperation) => (reject = rejectOperation),
        );
      }, 'save');
      if (failure !== 'synchronous failure') {
        expect(feedback.busy()).toBe(true);
        reject(error);
      }

      await expect(failed).resolves.toBeUndefined();
      expect(feedback.busy()).toBe(false);
      expect(feedback.error()).toBe('Unable to save. Please retry.');
      expect(feedback.sessionSuccess()).toBe(false);
      expect(describeFailure).toHaveBeenCalledExactlyOnceWith(error, 'save');

      let complete!: (result: MutationResult<void>) => void;
      const retry = feedback.run(
        () => new Promise<MutationResult<void>>((resolve) => (complete = resolve)),
        'save',
      );
      expect(feedback.busy()).toBe(true);
      expect(feedback.error()).toBeNull();
      complete({ value: undefined, durability: 'persistent' });
      await expect(retry).resolves.toEqual({ value: undefined, durability: 'persistent' });
      expect(feedback.busy()).toBe(false);
      expect(feedback.error()).toBeNull();
    },
  );

  it('reports session-only success and resets it on the next attempt, including rejected attempts', async () => {
    const feedback = new MutationFeedback(() => 'Unable to change.');
    const sessionResult = { value: 'session-item', durability: 'session-only' } as const;
    await expect(feedback.run(() => Promise.resolve(sessionResult), 'change')).resolves.toBe(
      sessionResult,
    );
    expect(feedback.sessionSuccess()).toBe(true);
    expect(feedback.busy()).toBe(false);

    let reject!: (error: unknown) => void;
    const pending = feedback.run(
      () => new Promise<MutationResult<void>>((_, rejectOperation) => (reject = rejectOperation)),
      'change',
    );
    expect(feedback.sessionSuccess()).toBe(false);
    reject(new Error('Unavailable'));
    await pending;
    expect(feedback.sessionSuccess()).toBe(false);

    await feedback.run(() => Promise.resolve(sessionResult), 'change');
    expect(feedback.sessionSuccess()).toBe(true);
    await feedback.run(
      () => Promise.resolve({ value: 'saved-item', durability: 'persistent' }),
      'change',
    );
    expect(feedback.sessionSuccess()).toBe(false);
    expect(feedback.error()).toBeNull();
  });
});
