import { effect, inject, signal, untracked } from '@angular/core';
import { ImageStorageService } from './image-storage.service';

/** Read a cached poster for this injection lifetime, retaining it while a replacement loads. */
export function injectPosterUrl(posterId: () => string | undefined) {
  const images = inject(ImageStorageService);
  const url = signal<string | null>(null);
  effect((onCleanup) => {
    const id = posterId();
    const version = images.version();
    let current = true;
    onCleanup(() => {
      current = false;
    });
    void untracked(() => images.getUrl(id))
      .catch(() => null)
      .then((value) => {
        // Identity/version may change before Angular reruns and cleans up this effect.
        if (current && id === posterId() && version === images.version()) url.set(value);
      });
  });
  return url.asReadonly();
}
