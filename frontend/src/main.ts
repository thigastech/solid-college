import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { iniciarAnalytics } from './app/core/analytics';

bootstrapApplication(AppComponent, appConfig)
  .then(() => iniciarAnalytics())
  .catch((err) => console.error(err));
