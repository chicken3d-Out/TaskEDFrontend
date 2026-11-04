import { Component, HostListener, inject } from '@angular/core';
import { LegalService } from './legal.service';
import { LegalContentComponent } from './legal-content.component';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-legal-modal',
  standalone: true,
  imports: [LegalContentComponent, IconComponent],
  template: `
    @if (legal.open(); as kind) {
      <div class="backdrop" (click)="legal.close()">
        <div class="dialog" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <div class="bar">
            <div class="tabs">
              <button type="button" [class.on]="kind === 'privacy'" (click)="legal.show('privacy')">Privacy Policy</button>
              <button type="button" [class.on]="kind === 'terms'" (click)="legal.show('terms')">Terms of Service</button>
            </div>
            <button type="button" class="x" (click)="legal.close()" aria-label="Close"><app-icon name="x" [size]="20" /></button>
          </div>
          <div class="body"><app-legal-content [type]="kind" /></div>
          <div class="foot"><button type="button" class="btn" (click)="legal.close()">Close</button></div>
        </div>
      </div>
    }
  `,
  styles: [`
    .backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .dialog { background: var(--surface, #fff); color: var(--text); border-radius: 16px; width: min(760px, 100%); max-height: 88vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
    .bar { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; padding: 0.7rem 0.9rem; border-bottom: 1px solid var(--border); }
    .tabs { display: flex; gap: 0.3rem; flex-wrap: wrap; button { border: none; background: transparent; padding: 0.4rem 0.8rem; border-radius: 9px; font-weight: 600; font-size: 0.88rem; color: var(--muted); cursor: pointer; &.on { background: var(--primary-soft); color: var(--primary-strong); } } }
    .x { border: none; background: transparent; cursor: pointer; padding: 0.3rem; border-radius: 8px; color: var(--muted); }
    .body { padding: 1rem 1.3rem; overflow-y: auto; }
    .foot { padding: 0.7rem 1rem; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; }
  `],
})
export class LegalModalComponent {
  legal = inject(LegalService);
  @HostListener('document:keydown.escape') onEsc() {
    this.legal.close();
  }
}
