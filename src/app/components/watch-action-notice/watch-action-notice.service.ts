import {
  DOCUMENT,
  DestroyRef,
  Injectable,
  Injector,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import type { MutationResult } from '../../services/storage.service';
import type { MutationFeedback } from '../mutation-feedback';
import { WatchChange, describeWatchChange } from '../../domain/watch-change';
import { WatchListService } from '../../services/watch-list.service';
import { watchActionFailure } from '../watch-action-feedback';

const NOTICE_DURATION_MS = 10_000;

interface WatchActionNotice {
  message: string;
  change?: WatchChange;
}

/** The latest watch command's acknowledgment and its one-step undo. */
@Injectable({
  providedIn: 'root',
})
export class WatchActionNoticeService {
  private readonly watchList = inject(WatchListService);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private timer: ReturnType<typeof setTimeout> | undefined;

  readonly notice = signal<WatchActionNotice | null>(null);
  readonly undoing = signal(false);

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  /** Runs a watch command, acknowledges its result, and keeps keyboard focus in a useful place. */
  async run<T extends WatchChange | undefined>(
    feedback: MutationFeedback,
    operation: () => Promise<MutationResult<T>>,
    failure: string,
  ) {
    const trigger = this.document.activeElement;
    const result = await feedback.run(operation, failure);
    if (result) this.announce(result.value);
    afterNextRender(() => this.restoreFocus(trigger), { injector: this.injector });
    return result;
  }

  private announce(change: WatchChange | undefined) {
    const message = change && describeWatchChange(change);
    if (message) this.show({ message, change });
  }

  // Controls disable while a command settles, and a finished title removes them altogether.
  private restoreFocus(trigger: Element | null) {
    if (this.document.activeElement !== this.document.body) return;
    const usable = trigger instanceof HTMLButtonElement && trigger.isConnected && !trigger.disabled;
    const target = usable
      ? trigger
      : this.document.querySelector<HTMLButtonElement>('app-watch-action-notice button');
    target?.focus();
  }

  async undo() {
    const change = this.notice()?.change;
    if (!change || this.undoing()) return;
    this.undoing.set(true);
    try {
      const { value: reverted } = await this.watchList.revertWatchChange(change);
      this.show({
        message: reverted
          ? `Undone: ${describeWatchChange(change)}`
          : 'This title changed after that action, so it can no longer be undone.',
      });
    } catch (error) {
      this.show({ message: watchActionFailure(error, 'Could not undo that action.') });
    } finally {
      this.undoing.set(false);
    }
  }

  dismiss() {
    this.pause();
    this.notice.set(null);
  }

  /** People reading or reaching for Undo should not lose it to the timer. */
  pause() {
    clearTimeout(this.timer);
  }

  resume() {
    this.pause();
    if (this.notice()) this.timer = setTimeout(() => this.dismiss(), NOTICE_DURATION_MS);
  }

  private show(notice: WatchActionNotice) {
    this.notice.set(notice);
    this.resume();
  }
}
