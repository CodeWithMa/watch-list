import { ItemStatus } from '../models/item.model';

export function statusButtonClass(isSelected: boolean, status: ItemStatus): string {
  const base = 'px-4 py-2 rounded font-medium cursor-pointer border transition-all';
  const unselected =
    'bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font border-light-border dark:border-dark-border hover:border-accent-primary';
  const selected = 'shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] border-transparent';

  if (!isSelected) {
    return `${base} ${unselected}`;
  }

  const colorClasses: Record<ItemStatus, string> = {
    'not-started':
      'bg-status-not-started-bg-light dark:bg-status-not-started-bg-dark text-status-not-started-text-light dark:text-status-not-started-text-dark',
    'in-progress':
      'bg-status-in-progress-bg-light dark:bg-status-in-progress-bg-dark text-status-in-progress-text-light dark:text-status-in-progress-text-dark',
    completed:
      'bg-status-completed-bg-light dark:bg-status-completed-bg-dark text-status-completed-text-light dark:text-status-completed-text-dark',
    dropped:
      'bg-status-dropped-bg-light dark:bg-status-dropped-bg-dark text-status-dropped-text-light dark:text-status-dropped-text-dark',
  };

  return `${base} ${selected} ${colorClasses[status]}`;
}
