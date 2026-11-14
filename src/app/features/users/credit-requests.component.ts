import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { LeaveService } from '../../core/services/leave.service';
import { CreditRequest, ServiceCreditsService } from '../../core/services/service-credits.service';

// Administrator: approve or decline an Administrative Officer's change to a saved service-credit count.
@Component({
  selector: 'app-credit-requests',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    <section class="card cq">
      <h3>Service Credit change requests @if (pending.length) { <span class="n">{{ pending.length }}</span> }</h3>
      @for (r of pending; track r.id) {
        <div class="req">
          <div><strong>{{ r.person }}</strong> <small class="muted">{{ r.school }}</small><br />
            {{ r.label }}: {{ r.oldBalance }} → <b>{{ r.newBalance }}</b><br />
            <small>Reason: {{ r.reason }}</small><br />
            <small class="muted">Asked by {{ r.requestedBy }} · {{ r.createdAt | date: 'medium' }}</small></div>
          <div class="act"><input type="text" [(ngModel)]="notes[r.id]" placeholder="Note (optional)" aria-label="Note" />
            <button class="btn" type="button" (click)="decide(r, true)" [disabled]="busy">Approve</button>
            <button class="btn secondary" type="button" (click)="decide(r, false)" [disabled]="busy">Decline</button></div>
        </div>
      } @empty { <p class="muted">Nothing waiting.</p> }
      @if (error) { <p class="error">{{ error }}</p> }
      <h4>Leave (Form 6) names printed on the form</h4>
      <div class="names">
        <label>Assistant Schools Division Superintendent (7.C)<input [(ngModel)]="asds" placeholder="Printed name" /></label>
        <label>HRMO II, authorized officer (7.A)<input [(ngModel)]="hrmo" placeholder="Printed name" /></label>
        <button class="btn" type="button" (click)="saveNames()" [disabled]="busy">Save names</button>
      </div>
      @if (nameMsg) { <p class="ok">{{ nameMsg }}</p> }
      @if (recent.length) {
        <details><summary>Recently decided</summary>
          @for (r of recent; track r.id) { <div class="rec"><small>{{ r.person }} · {{ r.label }} {{ r.oldBalance }} → {{ r.newBalance }} · <b>{{ r.status }}</b>{{ r.decidedNote ? ' · ' + r.decidedNote : '' }}</small></div> }
        </details>
      }
    </section>
  `,
  styles: [`.cq { padding: 1rem; margin-bottom: 1rem; } .cq h3 { margin: 0 0 .5rem; } .n { background: #dc2626; color: #fff; border-radius: 999px; padding: 0 .5rem; font-size: .75rem; }
    .req { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; padding: .6rem 0; border-top: 1px solid #f1f5f9; } .act { display: flex; gap: .4rem; flex-wrap: wrap; align-items: center; }
    .act input { padding: .4rem .5rem; border: 1px solid #d1d5db; border-radius: 8px; } .muted { color: #6b7280; } .error { color: #b91c1c; } .rec { padding: .2rem 0; } .names { display: flex; gap: .6rem; flex-wrap: wrap; align-items: flex-end; } .names label { display: flex; flex-direction: column; gap: .2rem; font-size: .82rem; font-weight: 600; } .names input { padding: .45rem .55rem; border: 1px solid #d1d5db; border-radius: 8px; min-width: 16rem; font-weight: 400; } .ok { color: #166534; } h4 { margin: 1rem 0 .4rem; }`],
})
export class CreditRequestsComponent implements OnInit {
  private api = inject(ServiceCreditsService);
  private leave = inject(LeaveService);
  asds = ''; hrmo = ''; nameMsg = '';
  pending: CreditRequest[] = []; recent: CreditRequest[] = []; notes: Record<string, string> = {}; busy = false; error = '';
  ngOnInit() { firstValueFrom(this.leave.settings()).then((s) => { this.asds = s.asds; this.hrmo = s.hrmo; }).catch(() => {}); firstValueFrom(this.api.requests()).then((r) => { this.pending = r.pending; this.recent = r.recent; }).catch(() => {}); }
  async saveNames() {
    this.busy = true; this.nameMsg = ''; this.error = '';
    try { const s = await firstValueFrom(this.leave.saveSettings({ asds: this.asds, hrmo: this.hrmo })); this.asds = s.asds; this.hrmo = s.hrmo; this.nameMsg = 'Saved.'; }
    catch (e: any) { this.error = e?.error?.message ?? 'Could not save.'; }
    this.busy = false;
  }
  async decide(r: CreditRequest, approve: boolean) {
    this.busy = true; this.error = '';
    try { const x = await firstValueFrom(this.api.decide(r.id, approve, this.notes[r.id] ?? '')); this.pending = x.pending; this.recent = x.recent; }
    catch (e: any) { this.error = e?.error?.message ?? 'Could not save.'; }
    this.busy = false;
  }
}
