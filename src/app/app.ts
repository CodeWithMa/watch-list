import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeSwitcherComponent } from './components/theme-switcher/theme-switcher.component';
import { StorageService } from './services/storage.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ThemeSwitcherComponent],
  templateUrl: './app.html',
  styles: [':host { display: block; min-height: 100vh; }'],
})
export class App {
  private readonly storageService = inject(StorageService);
  protected readonly title = signal('watch-list');
  protected readonly saveError = this.storageService.getSaveErrorSignal();
}
