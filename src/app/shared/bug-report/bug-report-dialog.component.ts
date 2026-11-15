import { Component, HostListener, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BugReportsService } from '../../core/services/bug-reports.service';
import { IconComponent } from '../icon/icon.component';

// Every signed-in user can send a problem to the Administrator from here (top-bar menu).
@Component({
  selector: 'app-bug-report',
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
    @if (api.dialog()) {
      <div class="bd" (click)="close()"></div>
      <div class="box" role="dialog" aria-modal="true" aria-label="Report a bug">
        <div class="head"><span class="ic"><app-icon name="bug" [size]="20" /></span><h2>Report a bug</h2><button type="button" class="x" (click)="close()" aria-label="Close"><app-icon name="x" [size]="20" /></button></div>
        @if (sent) {
          <div class="done"><app-icon name="check" [size]="30" /><p>Thank you. The Administrator has your report.</p><button class="btn" type="button" (click)="close()">Close</button></div>
        } @else {
          <p class="hint">Something not working, or looks wrong? Tell us what happened and the Administrator will see it. The page you are on is attached automatically.</p>
          <label>What went wrong (short title)<input [(ngModel)]="title" maxlength="140" placeholder="e.g. Form 6 will not download" /></label>
          <label>Tell us more<textarea [(ngModel)]="description" rows="5" maxlength="4000" placeholder="What did you press? What did you expect? What happened instead?"></textarea></label>
          @if (error) { <p class="error">{{ error }}</p> }
          <div class="acts"><button class="btn" type="button" (click)="send()" [disabled]="busy">@if (busy) { <span class="spin"></span> } {{ busy ? 'Sending…' : 'Send report' }}</button><button class="btn secondary" type="button" (click)="close()">Cancel</button></div>
        }
      </div>
    }
  `,
  styles: [`
    .bd { position: fixed; inset: 0; background: var(--overlay); z-index: 1300; }
    .box { position: fixed; z-index: 1301; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(520px, calc(100vw - 1.5rem)); max-height: calc(100dvh - 1.5rem); overflow: auto; background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 18px; padding: 1.1rem; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: .7rem; }
    .head { display: flex; align-items: center; gap: .6rem; } .head h2 { margin: 0; font-size: 1.1rem; flex: 1; }
    .ic { background: var(--err-bg); color: var(--err-fg); border-radius: 12px; width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; }
    .x { border: 0; background: transparent; color: var(--muted); border-radius: 8px; padding: .3rem; }
    .hint { margin: 0; color: var(--muted); font-size: .86rem; }
    label { display: flex; flex-direction: column; gap: .25rem; font-weight: 600; font-size: .85rem; } textarea { resize: vertical; }
    .acts { display: flex; gap: .5rem; flex-wrap: wrap; } .done { text-align: center; padding: 1rem 0; color: var(--ok-fg); display: flex; flex-direction: column; align-items: center; gap: .6rem; }
  `],
})
export class BugReportDialogComponent {
  api = inject(BugReportsService);
  private router = inject(Router);
  title = ''; description = ''; busy = false; error = ''; sent = false;

  @HostListener('document:keydown.escape') onEsc() { if (this.api.dialog()) this.close(); }

  async send() {
    this.busy = true; this.error = '';
    try {
      await firstValueFrom(this.api.create({ title: this.title, description: this.description, page: this.router.url.slice(0, 300), userAgent: navigator.userAgent.slice(0, 300) }));
      this.sent = true; this.title = ''; this.description = '';
    } catch (e: any) { this.error = e?.error?.message ?? 'Could not send. Check your connection and try again.'; }
    this.busy = false;
  }

  close() { this.api.closeDialog(); this.sent = false; this.error = ''; }
}
