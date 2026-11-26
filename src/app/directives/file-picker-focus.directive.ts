import { Directive } from '@angular/core';

@Directive({
  selector: 'input[type="file"][appFilePickerFocus]',
  host: {
    '(change)': 'restoreFocus()',
    '(cancel)': 'restoreFocus()',
  },
})
export class FilePickerFocusDirective {
  restoreFocus(): void {
    if (typeof window !== 'undefined' && typeof window.focus === 'function') {
      window.focus();
    }
  }
}
