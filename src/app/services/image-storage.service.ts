import { Injectable } from '@angular/core';
import { imageVersion, imagesInvalidated } from './image-invalidation';

const DATABASE_NAME = 'watch-list';
const DATABASE_VERSION = 2;
const STORE_NAME = 'images';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export interface StoredImage {
  id: string;
  blob: Blob;
}

export interface ExportedImage {
  id: string;
  type: string;
  data: string;
}

type PosterUrlCache = Map<string, Promise<string | null>>;

@Injectable({ providedIn: 'root' })
export class ImageStorageService {
  private database: Promise<IDBDatabase> | null = null;
  private readonly posterUrls: PosterUrlCache = new Map();
  readonly version = imageVersion.asReadonly();

  async storeFile(file: Blob): Promise<string> {
    await this.validateImage(file);
    const id = `image-${crypto.randomUUID()}`;
    await this.put({ id, blob: file });
    return id;
  }

  async storeUrl(url: string): Promise<string> {
    let response: Response;
    try {
      response = await fetch(url);
    } catch {
      throw new Error('Could not download the poster. Check the URL and your connection.');
    }
    if (!response.ok) throw new Error('Could not download the poster.');
    return this.storeFile(await response.blob());
  }

  async getUrl(id: string | undefined): Promise<string | null> {
    if (!id) return null;

    const existing = this.posterUrls.get(id);
    if (existing) return existing;

    const urlPromise = this.get(id).then((image) => {
      return image ? URL.createObjectURL(image.blob) : null;
    });
    this.posterUrls.set(id, urlPromise);
    void urlPromise.catch(() => {
      if (this.posterUrls.get(id) === urlPromise) this.posterUrls.delete(id);
    });
    return urlPromise;
  }

  async delete(id: string | undefined): Promise<void> {
    if (!id) return;
    await this.revokeUrl(id);
    const db = await this.openDatabase();
    await this.request(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id));
  }

  async exportImages(): Promise<ExportedImage[]> {
    const db = await this.openDatabase();
    const images = await this.request<StoredImage[]>(
      db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll(),
    );
    return Promise.all(
      images.map(async ({ id, blob }) => ({ id, type: blob.type, data: await blobToBase64(blob) })),
    );
  }

  async replaceImages(images: unknown): Promise<void> {
    const parsed = await this.parseExportedImages(images);
    for (const id of [...this.posterUrls.keys()]) await this.revokeUrl(id);
    const db = await this.openDatabase();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
    for (const image of parsed) store.put(image);
    await this.transaction(transaction);
    this.invalidateAll();
  }

  invalidateAll(): void {
    for (const id of [...this.posterUrls.keys()]) void this.revokeUrl(id);
    imagesInvalidated.next();
    imageVersion.update((version) => version + 1);
  }

  async parseExportedImages(images: unknown): Promise<StoredImage[]> {
    if (!Array.isArray(images)) throw new Error('Invalid image data');
    return Promise.all(images.map((image) => this.parseExportedImage(image)));
  }

  private async parseExportedImage(value: unknown): Promise<StoredImage> {
    if (!value || typeof value !== 'object') throw new Error('Invalid image data');
    const candidate = value as Partial<ExportedImage>;
    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.type !== 'string' ||
      typeof candidate.data !== 'string'
    ) {
      throw new Error('Invalid image data');
    }
    const blob = base64ToBlob(candidate.data, candidate.type);
    await this.validateImage(blob);
    return { id: candidate.id, blob };
  }

  private async validateImage(blob: Blob): Promise<void> {
    if (blob.size === 0 || blob.size > MAX_IMAGE_SIZE)
      throw new Error('Poster images must be 5 MB or smaller.');
    if (!blob.type.startsWith('image/'))
      throw new Error('Please choose a browser-supported image file.');
    try {
      await createImageBitmap(blob).then((bitmap) => bitmap.close());
    } catch {
      throw new Error('Please choose a browser-supported image file.');
    }
  }

  private async get(id: string): Promise<StoredImage | undefined> {
    const db = await this.openDatabase();
    return this.request(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id));
  }

  private async put(image: StoredImage): Promise<void> {
    const db = await this.openDatabase();
    await this.revokeUrl(image.id);
    await this.request(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(image));
  }

  private async revokeUrl(id: string): Promise<void> {
    const urlPromise = this.posterUrls.get(id);
    if (!urlPromise) return;

    this.posterUrls.delete(id);
    try {
      const url = await urlPromise;
      if (url) URL.revokeObjectURL(url);
    } catch {
      return;
    }
  }

  private openDatabase(): Promise<IDBDatabase> {
    this.database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME))
          request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Unable to open image storage'));
    });
    return this.database;
  }

  private request<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Image storage request failed'));
    });
  }

  private transaction(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error('Image storage transaction failed'));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('Image storage transaction aborted'));
    });
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(data: string, type: string): Blob {
  const bytes = atob(data);
  const values = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index++) values[index] = bytes.charCodeAt(index);
  return new Blob([values], { type });
}
