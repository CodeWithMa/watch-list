import { Component, inject, input, output, signal } from '@angular/core';
import { StorageService } from '../../services/storage.service';

/** Refresh shared collection state without navigating away from recoverable drafts. */
@Component({
  selector: 'app-conflict-recovery',
  template: `
    @if (conflict()) {
      <div role="alert" class="my-4 p-4 rounded border border-accent-warning">
        <p>The collection changed in another tab or window. Your changes were not saved.</p>
        <p>
          Refresh, review the latest collection, and retry your action. Your form input will stay
          here.
        </p>
        <button
          type="button"
          (click)="refresh()"
          [disabled]="busy() || disabled()"
          class="px-4 py-2 rounded bg-accent-primary text-white disabled:opacity-50"
        >
          Refresh collection
        </button>
        @if (error()) {
          <p>{{ error() }}</p>
        }
      </div>
    } @else if (refreshed()) {
      <p role="status" class="my-4">
        Collection refreshed. Review the latest changes and retry your action.
      </p>
    }
  `,
})
export class ConflictRecoveryComponent {
  private readonly storage = inject(StorageService);
  readonly conflict = this.storage.getConflictSignal();
  readonly disabled = input(false);
  readonly recovered = output();
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly refreshed = signal(false);

  async refresh() {
    if (this.busy() || this.disabled()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.storage.refresh();
      this.refreshed.set(true);
      this.recovered.emit();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Refresh failed. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }
}
