import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, vi } from 'vitest';
import { PosterPickerComponent } from './poster-picker/poster-picker.component';
import { ImageStorageService } from '../services/image-storage.service';
import { StorageService } from '../services/storage.service';
import { createSuggestionProviders } from '../services/suggestion-search.test-utils';

describe('Provisional poster lifecycle', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(['clear', 'cancel', 'destroy'] as const)(
    'releases an uploaded image on %s without storing an orphan',
    async (action) => {
      const { fixture, images, selected } = await setup();
      await upload(fixture.nativeElement as HTMLElement);
      await vi.waitFor(() => expect(selected()).toMatch(/^image-/));
      const id = selected()!;
      expect(await images.getUrl(id)).toBe('blob:draft');
      if (action === 'destroy') fixture.destroy();
      else if (action === 'cancel') fixture.componentInstance.clearDrafts();
      else fixture.componentInstance.clearPoster();
      expect(await images.getUrl(id)).toBeNull();
      expect(await images.exportImages()).toEqual([]);
    },
  );

  it.each(['supersede', 'cancel', 'destroy'] as const)(
    'discards a late download after %s without overwriting the active selection',
    async (action) => {
      const { fixture, images, selected } = await setup();
      let finish: (response: Response) => void = () => undefined;
      const response = new Promise<Response>((resolve) => {
        finish = resolve;
      });
      const fetch = vi.spyOn(globalThis, 'fetch').mockReturnValue(response);
      const component = fixture.componentInstance;
      component.storeFromUrl('https://example.com/late.png');
      await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
      let current: string | undefined;
      if (action === 'destroy') fixture.destroy();
      else if (action === 'cancel') component.clearDrafts();
      else {
        await upload(fixture.nativeElement as HTMLElement);
        await vi.waitFor(() => expect(selected()).toMatch(/^image-/));
        current = selected();
      }
      const lateId = '00000000-0000-4000-8000-000000000001';
      vi.spyOn(crypto, 'randomUUID').mockReturnValue(lateId);
      const downloaded = new Response();
      vi.spyOn(downloaded, 'blob').mockResolvedValue(new Blob(['download'], { type: 'image/png' }));
      finish(downloaded);
      // Native decoding is the final asynchronous preparation boundary before publishing a draft.
      await vi.waitFor(() =>
        expect(createImageBitmap).toHaveBeenCalledTimes(action === 'supersede' ? 2 : 1),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(selected()).toBe(current);
      expect(await images.getUrl(`image-${lateId}`)).toBeNull();
      if (current) expect(await images.getUrl(current)).toBe('blob:draft');
      expect(await images.exportImages()).toEqual([]);
      if (action !== 'destroy') fixture.destroy();
    },
  );
});

async function setup() {
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ close: vi.fn() }));
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:draft');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  TestBed.configureTestingModule({ providers: createSuggestionProviders().providers });
  await TestBed.inject(StorageService).initialize();
  const images = TestBed.inject(ImageStorageService);
  const fixture = TestBed.createComponent(PosterPickerComponent);
  let selected: string | undefined;
  fixture.componentInstance.posterIdChange.subscribe((id) => {
    selected = id;
    fixture.componentRef.setInput('posterId', id);
  });
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, images, selected: () => selected };
}

async function upload(root: HTMLElement) {
  const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: [new File(['upload'], 'poster.png', { type: 'image/png' })],
  });
  input.dispatchEvent(new Event('change'));
}
