import { Component, DOCUMENT, inject } from '@angular/core';
import { WatchActionNoticeService } from './watch-action-notice.service';

/** A persistent live region, so the message is announced when its text arrives. */
@Component({
  selector: 'app-watch-action-notice',
  host: {
    class:
      'fixed inset-x-0 bottom-0 z-90 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pointer-events-none print:hidden',
    'aria-live': 'polite',
    '(mouseenter)': 'notices.pause()',
    '(mouseleave)': 'notices.resume()',
    '(focusin)': 'notices.pause()',
    '(focusout)': 'notices.resume()',
  },
  template: `
    @if (notices.notice(); as notice) {
      <!-- Inverse surface from the theme's own text and background colors. -->
      <div
        class="relative overflow-hidden pointer-events-auto flex w-full max-w-xl items-center gap-2 rounded-lg pl-4 pr-1 py-1 shadow-lg bg-light-font text-light-bg-secondary dark:bg-dark-font dark:text-dark-bg-primary"
      >
        <p class="m-0 flex-1 min-w-0 py-2 text-sm line-clamp-2">{{ notice.message }}</p>
        @if (notice.change) {
          <button
            type="button"
            (click)="undo()"
            [disabled]="notices.undoing()"
            class="shrink-0 min-h-9 max-md:min-h-11 px-3 rounded-md border border-current/35 text-sm font-semibold cursor-pointer hover:bg-current/10 focus-visible:outline-current disabled:opacity-50"
          >
            Undo
          </button>
        }
        <button
          type="button"
          (click)="notices.dismiss()"
          aria-label="Dismiss message"
          class="shrink-0 size-11 rounded-md text-lg leading-none cursor-pointer hover:bg-current/10 focus-visible:outline-current"
        >
          <span aria-hidden="true">×</span>
        </button>
        <!-- Shows the time left; pauses with the timer and restarts with it. -->
        @for (run of [notices.timerRun()]; track run) {
          <span
            class="countdown absolute inset-x-0 bottom-0 h-0.5 origin-left bg-current opacity-40"
            [style.animation-duration.ms]="notices.durationMs"
            aria-hidden="true"
          ></span>
        }
      </div>
    }
  `,
  styles: `
    .countdown {
      animation: countdown linear forwards;
    }
    :host(:hover) .countdown,
    :host(:focus-within) .countdown {
      animation-play-state: paused;
    }
    @media (prefers-reduced-motion: reduce) {
      .countdown {
        display: none;
      }
    }
    @keyframes countdown {
      to {
        transform: scaleX(0);
      }
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
