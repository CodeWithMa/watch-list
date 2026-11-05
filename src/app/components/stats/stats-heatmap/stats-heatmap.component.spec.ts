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

    root.querySelector('button')!.click();
    fixture.detectChanges();
    expect(scroller.scrollLeft).toBe(900);
    expect(root.querySelector('button')).toBeNull();
  });
});
