import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { Item } from '../../models/item.model';
import { ImageStorageService } from '../../services/image-storage.service';
import { ProviderSettingsService } from '../../services/provider-settings.service';
import { PosterComponent } from './poster.component';

function createItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    title: 'Test Show',
    type: 'series',
    groupId: 'ungrouped',
    status: 'in-progress',
    isAdult: false,
    watchHistory: [],
    createdAt: '2026-04-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('PosterComponent', () => {
  let getUrlMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getUrlMock = vi.fn((id: string | undefined) => Promise.resolve(id ? `blob:${id}` : null));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ImageStorageService,
          useValue: { version: signal(0).asReadonly(), getUrl: getUrlMock },
        },
      ],
    });
  });

  it('renders the selected poster, retains it while loading, and falls back for a missing poster', async () => {
    const fixture = TestBed.createComponent(PosterComponent);
    fixture.componentRef.setInput('item', createItem({ posterId: 'p1' }));
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.posterUrl()).toBe('blob:p1'));
    fixture.detectChanges();
    const source = () => fixture.nativeElement.querySelector('img')?.getAttribute('src');
    expect(source()).toBe('blob:p1');

    let finish!: (url: string | null) => void;
    getUrlMock.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    fixture.componentRef.setInput('item', createItem({ posterId: 'missing' }));
    fixture.detectChanges();
    expect(getUrlMock).toHaveBeenLastCalledWith('missing');
    expect(source()).toBe('blob:p1');
    finish(null);
    await vi.waitFor(() => expect(fixture.componentInstance.posterUrl()).toBeNull());
    fixture.detectChanges();
    expect(source()).toBeUndefined();
    const fallback = fixture.nativeElement.querySelector('app-poster-fallback') as HTMLElement;
    expect(fallback.textContent?.trim()).toBe('');
  });

  it('keeps adult posters blurred until revealed and resets reveal for another item', async () => {
    TestBed.inject(ProviderSettingsService).setAdultDisplayMode('blur');
    const fixture = TestBed.createComponent(PosterComponent);
    fixture.componentRef.setInput('item', createItem({ posterId: 'adult', isAdult: true }));
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.posterUrl()).toBe('blob:adult'));
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('img')?.style.filter).toBe('blur(12px)');
    root.querySelector<HTMLButtonElement>('button[aria-label="Reveal adult poster"]')!.click();
    fixture.detectChanges();
    expect(root.querySelector('img')?.style.filter).toBe('');

    fixture.componentRef.setInput(
      'item',
      createItem({ id: 'another', posterId: 'adult', isAdult: true }),
    );
    fixture.detectChanges();
    expect(root.querySelector('img')?.style.filter).toBe('blur(12px)');
  });
});
