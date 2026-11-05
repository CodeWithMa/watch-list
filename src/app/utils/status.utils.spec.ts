import { ITEM_STATUSES } from '../domain/item.constants';
import { statusBadgeClass } from './status.utils';

describe('statusBadgeClass', () => {
  it.each(ITEM_STATUSES)('pairs the %s background and text colors', (status) => {
    expect(statusBadgeClass(status)).toContain(`bg-status-${status}`);
    expect(statusBadgeClass(status)).toContain(`text-status-${status}`);
  });
});
