import { ItemStatus } from '../models/item.model';

export function statusBadgeClass(isSelected: boolean, status: ItemStatus): Record<string, boolean> {
  return {
    'bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font border-light-border dark:border-dark-border hover:border-accent-primary': !isSelected,
    'bg-status-not-started-bg-light dark:bg-status-not-started-bg-dark text-status-not-started-text-light dark:text-status-not-started-text-dark shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] border-transparent': isSelected && status === 'not-started',
    'bg-status-in-progress-bg-light dark:bg-status-in-progress-bg-dark text-status-in-progress-text-light dark:text-status-in-progress-text-dark shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] border-transparent': isSelected && status === 'in-progress',
    'bg-status-completed-bg-light dark:bg-status-completed-bg-dark text-status-completed-text-light dark:text-status-completed-text-dark shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] border-transparent': isSelected && status === 'completed',
  };
}
