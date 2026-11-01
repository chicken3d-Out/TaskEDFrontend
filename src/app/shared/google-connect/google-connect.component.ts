import { Component, Input, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { IconComponent } from '../icon/icon.component';

// Shown when the user has not yet allowed TaskEd to use their Google Drive
// and/or Calendar. Files and events live in the user's own DepEd Google
// account, so this permission is what makes those features work.
@Component({
  selector: 'app-google-connect',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="gc">
      <app-icon name="folder" [size]="22" />
      <div class="txt">
        <strong>{{ what === 'drive' ? 'Connect your Google Drive' : what === 'calendar' ? 'Connect your Google Calendar' : 'Connect Google Drive and Calendar' }}</strong>
        <span>
          {{ what === 'drive'
            ? 'Your files are saved in your own DepEd Google Drive, so they do not use TaskEd storage.'
            : what === 'calendar'
              ? 'Events stay in sync between TaskEd and your DepEd Google Calendar.'
              : 'Files go to your DepEd Google Drive and events sync with your Google Calendar.' }}
          Choose your DepEd account and tick every box on the Google screen.
        </span>
      </div>
      <button class="btn" type="button" (click)="auth.connectGoogle()">Connect Google</button>
    </div>
  `,
  styles: [`
    .gc { display: flex; align-items: center; gap: 0.9rem; flex-wrap: wrap; background: #fffbeb; border: 1px solid #fcd34d; color: #78350f; border-radius: 14px; padding: 0.8rem 1rem; margin-bottom: 1rem; }
    .txt { flex: 1; min-width: 220px; display: flex; flex-direction: column; font-size: 0.85rem; gap: 0.15rem; }
  `],
})
export class GoogleConnectComponent {
  auth = inject(AuthService);
  @Input() what: 'drive' | 'calendar' | 'both' = 'both';
}
