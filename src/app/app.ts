import { Component, OnInit, signal, inject, Optional } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('watch-list');

  ngOnInit(): void {
    // Service worker update handling
    // Note: @angular/service-worker needs to be installed for this to work
    // In production builds with service worker enabled, this will handle updates
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Service worker update logic can be added here if needed
      // For now, Angular's service worker will handle updates automatically
    }
  }
}
