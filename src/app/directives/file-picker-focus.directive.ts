import { Directive } from '@angular/core';

@Directive({
  selector: 'input[type="file"][appFilePickerFocus]',
  host: {
    '(change)': 'focusWindowWhenPickerCloses()',
    '(cancel)': 'focusWindowWhenPickerCloses()',
  },
})
export class FilePickerFocusDirective {
  focusWindowWhenPickerCloses(): void {
    if (typeof window !== 'undefined' && typeof window.focus === 'function') {
      window.focus();
    }
  }
}
