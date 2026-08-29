import { ItemType } from '../models/item.model';

export type FilterType = ItemType | 'all';

export function typeButtonClass(isSelected: boolean, _type: FilterType): string {
  void _type;
  const base = 'px-4 py-2 rounded font-medium cursor-pointer border transition-all';
  const unselected =
    'bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font border-light-border dark:border-dark-border hover:border-accent-primary';
  const selected = 'shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] border-transparent';

  if (!isSelected) {
    return `${base} ${unselected}`;
  }

  return `${base} ${selected} bg-light-bg-tertiary dark:bg-dark-bg-tertiary`;
}
