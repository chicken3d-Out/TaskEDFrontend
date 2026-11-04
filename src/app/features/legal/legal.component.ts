import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LegalContentComponent } from '../../shared/legal/legal-content.component';

// The same documents on their own web address (/privacy and /terms). Google's
// sign-in review needs these links; inside the app they open in a modal instead.
@Component({
  selector: 'app-legal',
  standalone: true,
  imports: [RouterLink, LegalContentComponent],
  template: `
    <main class="wrap">
      <a routerLink="/login" class="back">← TaskEd</a>
      <app-legal-content [type]="kind" />
    </main>
  `,
  styles: [`
    .wrap { max-width: 760px; margin: 0 auto; padding: 2rem 1.2rem 4rem; color: var(--text); }
    .back { color: var(--muted); text-decoration: none; font-size: 0.9rem; display: inline-block; margin-bottom: 1rem; }
  `],
})
export class LegalComponent {
  kind: 'privacy' | 'terms' = inject(ActivatedRoute).snapshot.data['kind'] ?? 'privacy';
}
