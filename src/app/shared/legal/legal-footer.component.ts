import { Component, inject } from '@angular/core';
import { LegalService } from './legal.service';

// "Privacy Policy · Terms of Service" at the bottom of a page; opens the modal.
@Component({
  selector: 'app-legal-footer',
  standalone: true,
  template: `
    <footer class="lf">
      <button type="button" (click)="legal.show('privacy')">Privacy Policy</button>
      <span>·</span>
      <button type="button" (click)="legal.show('terms')">Terms of Service</button>
    </footer>
  `,
  styles: [`
    .lf { display: flex; justify-content: center; gap: 0.5rem; padding: 1.2rem 0 0.8rem; font-size: 0.78rem; color: var(--muted); }
    button { background: none; border: none; padding: 0; color: var(--muted); cursor: pointer; font-size: inherit; text-decoration: underline; }
    button:hover { color: var(--primary-strong); }
  `],
})
export class LegalFooterComponent {
  legal = inject(LegalService);
}
