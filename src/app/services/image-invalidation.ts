import { signal } from '@angular/core';
import { Subject } from 'rxjs';

export const imageVersion = signal(0);

export const imagesInvalidated = new Subject<void>();
