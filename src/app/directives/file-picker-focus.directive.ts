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
    // Request renderer focus whenever the native file picker closes, including cancellation.
    if (typeof window !== 'undefined' && typeof window.focus === 'function') {
      window.focus();
    }
  }
}
