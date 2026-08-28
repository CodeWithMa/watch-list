import { statusLineColor, statusButtonClass } from './status.utils';

describe('statusLineColor', () => {
  it('returns color class for each status', () => {
    expect(statusLineColor('not-started')).toContain('bg-status-not-started');
    expect(statusLineColor('in-progress')).toContain('bg-status-in-progress');
    expect(statusLineColor('paused')).toContain('bg-status-paused');
    expect(statusLineColor('completed')).toContain('bg-status-completed');
    expect(statusLineColor('dropped')).toContain('bg-status-dropped');
  });
});

describe('statusButtonClass', () => {
  it('returns unselected class when not selected', () => {
    expect(statusButtonClass(false, 'all')).toContain('bg-light-bg-secondary');
    expect(statusButtonClass(false, 'completed')).toContain('bg-light-bg-secondary');
  });

  it('returns selected class for all', () => {
    expect(statusButtonClass(true, 'all')).toContain('bg-light-bg-tertiary');
    expect(statusButtonClass(true, 'all')).toContain('shadow-');
  });

  it('returns selected color class for each ItemStatus', () => {
    expect(statusButtonClass(true, 'not-started')).toContain('bg-status-not-started');
    expect(statusButtonClass(true, 'in-progress')).toContain('bg-status-in-progress');
    expect(statusButtonClass(true, 'paused')).toContain('bg-status-paused');
    expect(statusButtonClass(true, 'completed')).toContain('bg-status-completed');
    expect(statusButtonClass(true, 'dropped')).toContain('bg-status-dropped');
  });
});
