import { Component, input } from '@angular/core';

@Component({
  selector: 'app-progress-bar',
  template: `
    <div class="w-full h-2 bg-light-border dark:bg-dark-border rounded overflow-hidden">
      <div
        class="h-full bg-accent-success transition-[width] duration-300 ease-in-out flex items-center justify-center"
        [style.width.%]="percentage()"
      >
        @if (showText()) {
          <span class="text-[10px] text-white font-bold">{{ percentage() }}%</span>
        }
      </div>
    </div>
  `,
})
export class ProgressBarComponent {
  percentage = input.required<number>();
  showText = input<boolean>(false);
}
