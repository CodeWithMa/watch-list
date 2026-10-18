/** Read models share settled state; command drafts remain mutable. */
export type DeepReadonly<T> = { readonly [K in keyof T]: DeepReadonly<T[K]> };

/** Freeze once at publication, rather than cloning on each reactive read. */
export function freezeReadModel<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeReadModel(child);
    Object.freeze(value);
  }
  return value;
}
