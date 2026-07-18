import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'items',
    loadComponent: () =>
      import('./components/item-list/item-list.component').then((m) => m.ItemListComponent),
  },
  {
    path: 'items/add',
    loadComponent: () =>
      import('./components/add-item/add-item.component').then((m) => m.AddItemComponent),
  },
  {
    path: 'items/:id',
    loadComponent: () =>
      import('./components/item-detail/item-detail.component').then((m) => m.ItemDetailComponent),
  },
  {
    path: 'groups',
    loadComponent: () =>
      import('./components/group-manager/group-manager.component').then(
        (m) => m.GroupManagerComponent,
      ),
  },
  {
    path: 'history',
    loadComponent: () =>
      import('./components/watch-history/watch-history.component').then(
        (m) => m.WatchHistoryComponent,
      ),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./components/settings/settings.component').then((m) => m.SettingsComponent),
  },
];
