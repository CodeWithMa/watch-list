import { Component, DOCUMENT, inject } from '@angular/core';
import { WatchActionNoticeService } from './watch-action-notice.service';

/** A persistent live region, so the message is announced when its text arrives. */
@Component({
  selector: 'app-watch-action-notice',
  host: {
    class:
      'fixed inset-x-0 bottom-0 z-90 flex justify-center px-4 pb-4 pointer-events-none print:hidden',
    'aria-live': 'polite',
    '(mouseenter)': 'notices.pause()',
    '(mouseleave)': 'notices.resume()',
    '(focusin)': 'notices.pause()',
    '(focusout)': 'notices.resume()',
  },
  template: `
    @if (notices.notice(); as notice) {
      <div
        class="pointer-events-auto flex w-full max-w-xl items-center gap-2 rounded-lg px-4 py-2 shadow-lg bg-[#2d2d2d] text-white dark:bg-[#f5f5f5] dark:text-[#1a1a1a]"
      >
        <p class="m-0 flex-1 min-w-0 py-1 text-sm line-clamp-2">{{ notice.message }}</p>
        @if (notice.change) {
          <button
            type="button"
            (click)="undo()"
            [disabled]="notices.undoing()"
            class="shrink-0 min-h-11 px-3 rounded text-sm font-semibold underline cursor-pointer disabled:opacity-50"
          >
            Undo
          </button>
        }
        <button
          type="button"
          (click)="notices.dismiss()"
          aria-label="Dismiss message"
          class="shrink-0 size-11 rounded text-lg leading-none cursor-pointer"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
    }
  `,
})
export class WatchActionNoticeComponent {
  protected readonly notices = inject(WatchActionNoticeService);
  private readonly document = inject(DOCUMENT);
  protected async undo() {
    await this.notices.undo();
    if (this.focusWasLost()) this.document.getElementById('main-content')?.focus();
  }

  private focusWasLost() {
    const active = this.document.activeElement;
    return !active || active === this.document.body;
  }
}
