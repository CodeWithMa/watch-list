import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ImageStorageService } from './image-storage.service';
import { injectPosterUrl } from './poster-reader';

function deferredRead(id: string | undefined) {
  let resolve!: (url: string | null) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string | null>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { id, promise, resolve, reject };
}

describe('Poster read lifetime', () => {
  const version = signal(0);
  let reads: ReturnType<typeof deferredRead>[];

  beforeEach(() => {
    version.set(0);
    reads = [];
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ImageStorageService,
          useValue: {
            version: version.asReadonly(),
            getUrl: (id: string | undefined) => {
              const read = deferredRead(id);
              reads.push(read);
              return read.promise;
            },
          },
        },
      ],
    });
  });

  function createReader(initialId: string | undefined = 'first') {
    const injector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
    const id = signal<string | undefined>(initialId);
    const url = runInInjectionContext(injector, () => injectPosterUrl(id));
    TestBed.tick();
    return { id, url, destroy: () => injector.destroy() };
  }

  async function settle() {
    await Promise.resolve();
    await Promise.resolve();
    TestBed.tick();
  }

  it('publishes the selected poster and retains it while a replacement is pending', async () => {
    const reader = createReader();
    expect(reader.url()).toBeNull();
    expect(reads.map((read) => read.id)).toEqual(['first']);
    reads[0].resolve('blob:first');
    await settle();
    expect(reader.url()).toBe('blob:first');

    reader.id.set('replacement');
    TestBed.tick();
    expect(reads[1].id).toBe('replacement');
    expect(reader.url()).toBe('blob:first');
    reads[1].resolve('blob:replacement');
    await settle();
    expect(reader.url()).toBe('blob:replacement');
    reader.destroy();
  });

  it('ignores obsolete completions even after returning to the original poster identity', async () => {
    const reader = createReader();
    reader.id.set('second');
    TestBed.tick();
    reader.id.set('first');
    TestBed.tick();

    reads[2].resolve('blob:current-first');
    await settle();
    expect(reader.url()).toBe('blob:current-first');
    reads[1].resolve('blob:second');
    reads[0].resolve('blob:obsolete-first');
    await settle();
    expect(reader.url()).toBe('blob:current-first');
    reader.destroy();
  });

  it('rejects a changed identity before its replacement effect has run', async () => {
    const reader = createReader();
    reader.id.set('second');
    reads[0].resolve('blob:obsolete');
    await Promise.resolve();
    await Promise.resolve();
    expect(reader.url()).toBeNull();

    TestBed.tick();
    reads[1].resolve('blob:second');
    await settle();
    expect(reader.url()).toBe('blob:second');
    reader.destroy();
  });

  it('rereads on invalidation and rejects completions from older generations', async () => {
    const reader = createReader();
    version.update((value) => value + 1);
    reads[0].resolve('blob:obsolete');
    await Promise.resolve();
    await Promise.resolve();
    expect(reader.url()).toBeNull();
    TestBed.tick();
    expect(reads.map((read) => read.id)).toEqual(['first', 'first']);

    version.update((value) => value + 1);
    TestBed.tick();
    reads[2].resolve('blob:fresh');
    await settle();
    reads[1].resolve('blob:older-generation');
    await settle();
    expect(reader.url()).toBe('blob:fresh');
    reader.destroy();
  });

  it('stops publishing after destruction while another reader can finish', async () => {
    const destroyed = createReader();
    const active = createReader();
    destroyed.destroy();
    reads[0].resolve('blob:shared');
    reads[1].resolve('blob:shared');
    await settle();
    expect(destroyed.url()).toBeNull();
    expect(active.url()).toBe('blob:shared');

    version.update((value) => value + 1);
    TestBed.tick();
    expect(reads).toHaveLength(3);
    active.destroy();
    reads[2].resolve('blob:after-destruction');
    await settle();
    expect(active.url()).toBe('blob:shared');
  });

  it('falls back when the selected poster is cleared', async () => {
    const reader = createReader();
    reads[0].resolve('blob:first');
    await settle();
    reader.id.set(undefined);
    TestBed.tick();
    expect(reads[1].id).toBeUndefined();
    reads[1].resolve(null);
    await settle();
    expect(reader.url()).toBeNull();
    reader.destroy();
  });

  it('does not clear the current poster when an obsolete read fails', async () => {
    const reader = createReader();
    reader.id.set('second');
    TestBed.tick();
    reads[1].resolve('blob:second');
    await settle();
    reads[0].reject(new Error('Obsolete failure'));
    await settle();
    expect(reader.url()).toBe('blob:second');
    reader.destroy();
  });

  it.each(['missing', 'failed'] as const)(
    'falls back after a %s read and can recover on later invalidation',
    async (outcome) => {
      const reader = createReader();
      reads[0].resolve('blob:first');
      await settle();
      version.update((value) => value + 1);
      TestBed.tick();
      if (outcome === 'missing') reads[1].resolve(null);
      else reads[1].reject(new Error('Unavailable storage'));
      await settle();
      expect(reader.url()).toBeNull();

      version.update((value) => value + 1);
      TestBed.tick();
      reads[2].resolve('blob:recovered');
      await settle();
      expect(reader.url()).toBe('blob:recovered');
      reader.destroy();
    },
  );
});
