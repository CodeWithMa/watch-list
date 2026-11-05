import { TestBed } from '@angular/core/testing';
import { StatsHeatmapComponent } from './stats-heatmap.component';

describe('StatsHeatmapComponent', () => {
  function setup() {
    const fixture = TestBed.createComponent(StatsHeatmapComponent);
    fixture.componentRef.setInput('historyEntries', []);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const scroller = root.querySelector<HTMLElement>('[role="group"]')!;
    const layout = (clientWidth: number, scrollLeft = scroller.scrollLeft) => {
      Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: clientWidth });
      Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: 900 });
      scroller.scrollLeft = scrollLeft;
    };
    const resize = () => {
      window.dispatchEvent(new Event('resize'));
      fixture.detectChanges();
    };
    return { fixture, root, scroller, layout, resize };
  }

  it('shows no scroll caption while the whole year fits', () => {
    const { root, layout, resize } = setup();
    layout(900);
    resize();
    expect(root.textContent).not.toContain('scroll sideways');
  });

  it('moves to the recent end when narrowing an untouched chart', () => {
    const { root, scroller, layout, resize } = setup();
    layout(900);
    resize();
    layout(340, 0);
    resize();
    expect(scroller.scrollLeft).toBe(900);
    expect(root.textContent).toContain('Past year');
    expect(root.textContent).not.toContain('Today');
  });

  it('keeps a chosen historical position through a resize and can return to today', () => {
    const { fixture, root, scroller, layout, resize } = setup();
    layout(340, 900);
    resize();
    layout(340, 120);
    scroller.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();

    layout(500);
    resize();
    expect(scroller.scrollLeft).toBe(120);

    root.querySelector<HTMLButtonElement>('button:not([data-date])')!.click();
    fixture.detectChanges();
    expect(scroller.scrollLeft).toBe(900);
    expect(root.querySelector('button:not([data-date])')).toBeNull();
  });

  it('names the unit and reveals a day by tap or keyboard from a single tab stop', () => {
    const fixture = TestBed.createComponent(StatsHeatmapComponent);
    fixture.componentRef.setInput('historyEntries', []);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    document.body.append(root);
    expect(root.textContent).toContain('Watches per day');

    expect(root.querySelectorAll('[data-date][tabindex="0"]')).toHaveLength(1);
    const last = root.querySelector<HTMLButtonElement>('[data-date][tabindex="0"]')!;
    last.click();
    fixture.detectChanges();
    expect(root.querySelector('[aria-live]')?.textContent).toContain('0 entries');

    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    fixture.detectChanges();
    expect(root.querySelectorAll('[data-date][tabindex="0"]')).toHaveLength(1);
    expect(root.querySelector('[data-date][tabindex="0"]')).not.toBe(last);
    root.remove();
  });
});
