import { Routes } from '@angular/router';

import { HomePageComponent } from './features/home/home-page.component';

export const routes: Routes = [
  { path: '', component: HomePageComponent },
  {
    path: 'privacidade',
    loadComponent: () =>
      import('./features/privacidade/privacidade-page.component').then((m) => m.PrivacidadePageComponent),
  },
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/admin-page.component').then((m) => m.AdminPageComponent),
  },
  { path: '**', redirectTo: '' },
];
