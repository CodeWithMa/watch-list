import { Component, input } from '@angular/core';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-progress-bar',
  imports: [NgIf],
  template: `
    <div class="progress-container">
      <div class="progress-bar" [style.width.%]="percentage()">
        <span class="progress-text" *ngIf="showText()">{{ percentage() }}%</span>
      </div>
    </div>
  `,
  styles: [`
    .progress-container {
      width: 100%;
      height: 8px;
      background-color: #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-bar {
      height: 100%;
      background-color: #4caf50;
      transition: width 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .progress-text {
      font-size: 10px;
      color: white;
      font-weight: bold;
    }
  `]
})
export class ProgressBarComponent {
  percentage = input.required<number>();
  showText = input<boolean>(false);
}

