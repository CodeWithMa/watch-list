export type DeepReadonly<T> = { readonly [K in keyof T]: DeepReadonly<T[K]> };

export function freezeReadModel<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeReadModel(child);
    Object.freeze(value);
  }
  return value;
}
