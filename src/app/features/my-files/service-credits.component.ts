import { Component, EventEmitter, Input, OnInit, Output, ViewChild, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { CreditCard, CreditKind, CreditLog, CreditOverview, ServiceCreditsService } from '../../core/services/service-credits.service';
import { TaAttPreviewService } from '../../shared/travel-authority/ta-att-preview.component';
import { ROLE_LABELS } from '../../core/models/user.model';
import { LeaveComponent } from './leave.component';

const MAX_SO = 4 * 1024 * 1024;
const today = () => new Date().toISOString().slice(0, 10);

// Service Credits and Leave (Form 6) on one page: the cards with what is left, a button to apply for leave,
// and two tabs: Form 6 and Logs. Your own credits are view-only; the school's AO keeps the counts.
@Component({
  selector: 'app-service-credits',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, LeaveComponent],
  template: `
    @if (!o) { <p class="muted">{{ error || 'Loading…' }}</p> } @else {
      <h3 class="who">{{ personId ? o.user.name : 'My service credits' }} <small class="muted">{{ roleName(o.user.role) }}@if (o.user.school) { · {{ o.user.school }} }</small></h3>
      <div class="cards">
        @for (c of o.credits; track c.kind) {
          <div class="card cr" [class.wl]="c.kind === 'wellness'">
            <small>{{ c.label }}</small>
            @if (c.usable || c.initialSet) { <b>{{ c.balance }}</b><span class="d">{{ c.balance === 1 ? 'day' : 'days' }}</span> } @else { <b class="dash">—</b><span class="d">not set yet</span> }
            @if (c.note) { <em>{{ c.note }}</em> }
            @for (e of c.expires ?? []; track e.on) { <em class="warn">{{ e.amount }} expires {{ e.on | date: 'mediumDate' }}</em> }
            @if (c.pending) { <em class="warn">Change to {{ c.pending.newBalance }} waits for the Administrator</em> }
            @if (manage && o.canManage) {
              @if (!c.initialSet && !o.direct) {
                <div class="row"><input type="number" min="0" step="0.5" inputmode="decimal" [(ngModel)]="initial[c.kind]" [placeholder]="c.usable ? 'Current count' : 'Initial count'" aria-label="Count" /><button class="btn" type="button" (click)="saveInitial(c)" [disabled]="busy">Set</button></div>
              } @else if (!c.pending) {
                <button class="btn secondary sm" type="button" (click)="startEdit(c)">{{ o.direct ? 'Edit count' : 'Request change' }}</button>
                @if (editKind === c.kind) {
                  <div class="edit">
                    <input type="number" min="0" step="0.5" inputmode="decimal" [(ngModel)]="editBalance" placeholder="New count" aria-label="New count" />
                    <input type="text" [(ngModel)]="editReason" [placeholder]="o.direct ? 'Note (optional)' : 'Reason (required)'" aria-label="Reason" />
                    <div class="row"><button class="btn" type="button" (click)="saveEdit(c)" [disabled]="busy">{{ o.direct || o.isAdmin ? 'Save' : 'Send to Administrator' }}</button><button class="btn secondary" type="button" (click)="editKind = null">Cancel</button></div>
                    @if (!o.direct && !o.isAdmin) { <small class="muted">A change to a saved count needs the Administrator’s approval.</small> }
                  </div>
                }
              }
            }
          </div>
        }
      </div>

      <div class="actions">
        @if (!noLeave) { <button class="btn" type="button" (click)="apply()">Apply for leave (Form 6)</button> }
        @if (manage && o.canManage) { <button class="btn secondary" type="button" (click)="soOpen = !soOpen">{{ soOpen ? 'Close' : 'Add credits (Special Order)' }}</button> }
      </div>

      @if (soOpen && manage && o.canManage) {
        <section class="card so">
          <h4>Add credits from a Special Order</h4>
          <div class="grid">
            <label>Credit
              <select [(ngModel)]="soKind">@for (c of soKinds(); track c.kind) { <option [value]="c.kind">{{ c.label }}</option> }</select></label>
            <label>Days to add<input type="number" min="0.5" step="0.5" inputmode="decimal" [(ngModel)]="soAmount" /></label>
            <label>S.O. number<input type="text" [(ngModel)]="soNumber" placeholder="e.g. 123, s. 2026" /></label>
            @if (soKind === 'cto') { <label>Date approved (good for one year)<input type="date" [(ngModel)]="soDate" /></label> }
            <label>Special Order (JPG, PNG or PDF, up to 4 MB)<input type="file" accept="image/jpeg,image/png,application/pdf" (change)="soFile = $any($event.target).files?.[0] ?? null" /></label>
          </div>
          <button class="btn" type="button" (click)="addSo()" [disabled]="busy || !soNumber || !soAmount || !soFile || !soKind">{{ busy ? 'Saving…' : 'Add credits' }}</button>
          <small class="muted"> Vacation, Sick, Force and Special Privilege Leave and Wellness are earned or renewed by themselves.</small>
        </section>
      }
      @if (msg) { <p class="ok">{{ msg }}</p> } @if (error) { <p class="error">{{ error }}</p> }

      <div class="seg" role="tablist">
        @if (!noLeave) { <button type="button" [class.on]="tab === 'form6'" (click)="tab = 'form6'">Form 6</button> }
        <button type="button" [class.on]="tab === 'logs'" (click)="tab = 'logs'">Logs</button>
      </div>

      @if (!noLeave) { <div [hidden]="tab !== 'form6'"><app-leave #lv [person]="person" [hideBar]="true" (changed)="reload()" /></div> }
      @if (tab === 'logs' || noLeave) {
        @for (l of o.logs; track l.id) {
          <div class="log">
            <div class="main"><strong>{{ l.label }}</strong> <span class="t">{{ typeName(l) }}</span>
              <small class="muted">{{ l.createdAt | date: 'medium' }}@if (l.actor) { · {{ l.actor }} }</small>
              @if (l.reason) { <small>{{ l.reason }}</small> }
              @if (l.fileUrl) { <small><a href="javascript:void(0)" (click)="openSo(l)">View Special Order{{ l.soNumber ? ' ' + l.soNumber : '' }}</a></small> }
            </div>
            <div class="n" [class.neg]="l.delta < 0">{{ l.delta > 0 ? '+' : '' }}{{ l.delta }}<small>→ {{ l.balanceAfter }}</small></div>
          </div>
        } @empty { <p class="muted">Nothing logged yet.</p> }
      }
    }
  `,
  styles: [`
    .seg { display: inline-flex; border: 1px solid #d1d5db; border-radius: 999px; overflow: hidden; margin: 1rem 0; }
    .seg button { border: 0; background: #fff; padding: .45rem 1.2rem; font: inherit; cursor: pointer; } .seg .on { background: #166534; color: #fff; }
    .muted { color: #6b7280; } .ok { color: #166534; } .error { color: #b91c1c; }
    .who { margin: .5rem 0; } .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: .7rem; margin-bottom: 1rem; }
    .cr { padding: .8rem 1rem; display: flex; flex-direction: column; gap: .2rem; } .cr small { color: #6b7280; }
    .cr b { font-size: 2rem; line-height: 1.1; color: #166534; } .cr b.dash { color: #9ca3af; } .cr .d { font-size: .8rem; color: #6b7280; } .cr.wl b { color: #0369a1; }
    .cr em { font-size: .75rem; color: #6b7280; font-style: normal; } .cr em.warn { color: #92400e; }
    .actions { display: flex; gap: .6rem; flex-wrap: wrap; margin-bottom: .6rem; }
    .row { display: flex; gap: .4rem; flex-wrap: wrap; margin-top: .3rem; } .row input { width: 6.5rem; } .sm { padding: .25rem .6rem; font-size: .8rem; align-self: flex-start; margin-top: .3rem; }
    .edit { display: flex; flex-direction: column; gap: .35rem; margin-top: .4rem; }
    input, select { padding: .4rem .5rem; border: 1px solid #d1d5db; border-radius: 8px; font: inherit; min-width: 0; }
    .so { padding: .8rem 1rem; margin-bottom: 1rem; } .so h4 { margin: 0 0 .5rem; } .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: .6rem; margin-bottom: .6rem; } .grid label { display: flex; flex-direction: column; gap: .2rem; font-size: .85rem; }
    .log { display: flex; justify-content: space-between; gap: 1rem; padding: .55rem 0; border-bottom: 1px solid #f1f5f9; } .log .main { display: flex; flex-direction: column; gap: .1rem; min-width: 0; }
    .log .t { background: #e0f2fe; color: #075985; border-radius: 999px; padding: 0 .5rem; font-size: .72rem; margin-left: .3rem; } .log .n { text-align: right; font-weight: 700; color: #166534; white-space: nowrap; } .log .n.neg { color: #b91c1c; } .log .n small { display: block; font-weight: 400; color: #6b7280; }
    .log a { color: #15803d; }
  `],
})
export class ServiceCreditsComponent implements OnInit {
  private api = inject(ServiceCreditsService);
  private attPreview = inject(TaAttPreviewService);
  @ViewChild('lv') lv?: LeaveComponent;

  // set for the AO's view of one person; empty for your own credits
  @Input() personId = '';
  @Input() person: { id: string; name: string; position?: string; station?: string } | null = null;
  @Input() noLeave = false;
  @Output() changed = new EventEmitter<void>();

  o: CreditOverview | null = null;
  tab: 'form6' | 'logs' = 'form6';
  busy = false; msg = ''; error = '';
  initial: Record<string, number | null> = {};
  editKind: string | null = null; editBalance: number | null = null; editReason = '';
  soOpen = false; soKind: CreditKind | '' = ''; soAmount: number | null = null; soNumber = ''; soDate = today(); soFile: File | null = null;

  get manage() { return !!this.personId; }
  roleName(r: string) { return (ROLE_LABELS as Record<string, string>)[r] ?? r; }
  typeName(l: CreditLog) { return ({ initial: 'Initial count', special_order: 'Special Order', edit: 'Changed', reset: 'Yearly renewal', deduction: 'Leave used', restore: 'Restored', accrual: 'Monthly earning', expiry: 'Expired' } as const)[l.type] ?? l.type; }
  soKinds() { return (this.o?.credits ?? []).filter((c) => c.kind === 'cto' || c.kind === 'service_credit'); }

  ngOnInit() { if (this.noLeave) this.tab = 'logs'; void this.reload(); }

  async reload() {
    try {
      this.o = this.personId ? await firstValueFrom(this.api.user(this.personId)) : await firstValueFrom(this.api.mine());
      if (!this.soKind || !this.soKinds().some((c) => c.kind === this.soKind)) this.soKind = this.soKinds()[0]?.kind ?? '';
    } catch (e: any) { this.error = e?.error?.message ?? 'Could not load the credits.'; }
  }

  apply() { this.tab = 'form6'; void this.lv?.startNew(); }

  private async run(fn: () => Promise<void>) {
    this.busy = true; this.msg = ''; this.error = '';
    try { await fn(); this.changed.emit(); } catch (e: any) { this.error = e?.error?.message ?? e?.message ?? 'Something went wrong.'; }
    this.busy = false;
  }

  saveInitial(c: CreditCard) {
    const n = this.initial[c.kind];
    if (n == null || n < 0) { this.error = 'Enter the count.'; return; }
    void this.run(async () => { this.o = await firstValueFrom(this.api.setInitial(this.o!.user.id, c.kind, n)); this.msg = `${c.label} set to ${n}.`; });
  }

  startEdit(c: CreditCard) { this.editKind = c.kind; this.editBalance = c.balance; this.editReason = ''; this.msg = ''; this.error = ''; }

  saveEdit(c: CreditCard) {
    if (this.editBalance == null) return;
    void this.run(async () => {
      this.o = await firstValueFrom(this.api.requestEdit(this.o!.user.id, c.kind, this.editBalance!, this.editReason));
      this.editKind = null;
      this.msg = this.o.direct || this.o.isAdmin ? 'Saved.' : 'Sent to the Administrator for approval.';
    });
  }

  addSo() {
    const f = this.soFile;
    if (!f || !this.soKind || !this.soAmount || !this.o) return;
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(f.type)) { this.error = 'The Special Order must be a JPG, PNG or PDF.'; return; }
    if (f.size > MAX_SO) { this.error = 'The Special Order must be 4 MB or smaller.'; return; }
    void this.run(async () => {
      const signed = await firstValueFrom(this.api.uploadSignature());
      const form = new FormData();
      for (const [k, v] of Object.entries(signed.fields)) form.append(k, v);
      form.append('file', f, f.name);
      const res = await fetch(signed.uploadUrl, { method: 'POST', body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.secure_url) throw new Error(body?.error?.message ?? `Upload failed (${res.status})`);
      const label = this.o!.credits.find((c) => c.kind === this.soKind)?.label;
      this.o = await firstValueFrom(this.api.specialOrder(this.o!.user.id, { kind: this.soKind as CreditKind, amount: this.soAmount!, soNumber: this.soNumber, fileName: f.name, url: body.secure_url, publicId: body.public_id ?? '', approvedOn: this.soKind === 'cto' ? this.soDate : undefined }));
      this.msg = `Added ${this.soAmount} to ${label}.`;
      this.soAmount = null; this.soNumber = ''; this.soFile = null; this.soOpen = false;
    });
  }

  openSo(l: CreditLog) { void this.attPreview.open('', { id: l.id, name: l.fileName ?? 'Special Order', mime: /\.pdf$/i.test(l.fileUrl ?? '') ? 'application/pdf' : 'image/jpeg', size: 0, url: l.fileUrl }); }
}
