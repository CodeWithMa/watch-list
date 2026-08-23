import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { imageVersion } from '../../services/image-invalidation';
import { ImageStorageService } from '../../services/image-storage.service';
import { ItemCardComponent } from './item-card.component';
import { Item } from '../../models/item.model';

const item: Item = {
  id: 'item-1',
  type: 'movie',
  title: 'Movie',
  groupId: '',
  status: 'not-started',
  watchHistory: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  posterId: 'poster-1',
};

describe('ItemCardComponent poster refresh', () => {
  it('reloads the same poster after image invalidation', async () => {
    let urlPromise = Promise.resolve('blob:first');
    const getUrl = vi.fn((_posterId?: string): Promise<string> => {
      void _posterId;
      return urlPromise;
    });

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ImageStorageService, useValue: { getUrl, version: imageVersion.asReadonly() } },
      ],
    });
    const fixture = TestBed.createComponent(ItemCardComponent);
    fixture.componentRef.setInput('item', item);
    fixture.detectChanges();

    await Promise.resolve();
    expect(getUrl).toHaveBeenCalledTimes(1);
    expect(getUrl.mock.calls.every((call) => call[0] === item.posterId)).toBe(true);

    urlPromise = Promise.resolve('blob:second');
    imageVersion.update((version) => version + 1);
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(getUrl).toHaveBeenCalledTimes(2);
  });
});
