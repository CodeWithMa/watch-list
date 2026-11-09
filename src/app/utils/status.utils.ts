import { ItemStatus } from '../models/item.model';

export function statusBadgeClass(status: ItemStatus): string {
  const colors: Record<ItemStatus, string> = {
    'not-started':
      'bg-status-not-started-bg-light dark:bg-status-not-started-bg-dark text-status-not-started-text-light dark:text-status-not-started-text-dark',
    'in-progress':
      'bg-status-in-progress-bg-light dark:bg-status-in-progress-bg-dark text-status-in-progress-text-light dark:text-status-in-progress-text-dark',
    paused:
      'bg-status-paused-bg-light dark:bg-status-paused-bg-dark text-status-paused-text-light dark:text-status-paused-text-dark',
    completed:
      'bg-status-completed-bg-light dark:bg-status-completed-bg-dark text-status-completed-text-light dark:text-status-completed-text-dark',
    dropped:
      'bg-status-dropped-bg-light dark:bg-status-dropped-bg-dark text-status-dropped-text-light dark:text-status-dropped-text-dark',
  };

  return `tag ${colors[status]}`;
}

export type FilterStatus = ItemStatus | 'all';
