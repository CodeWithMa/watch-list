import { Component, signal, OnInit, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from './services/theme.service';
import { ThemeSwitcherComponent } from './components/theme-switcher/theme-switcher.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ThemeSwitcherComponent],
  templateUrl: './app.html',
  styles: [':host { display: block; min-height: 100vh; }']
})
export class App implements OnInit {
  protected readonly title = signal('watch-list');
  private themeService = inject(ThemeService);

  ngOnInit(): void {
    this.themeService.init();
  }
}
