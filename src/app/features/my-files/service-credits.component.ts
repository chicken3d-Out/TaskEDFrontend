import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { CreditCard, CreditKind, CreditLog, CreditOverview, ServiceCreditsService } from '../../core/services/service-credits.service';
import { TaAttPreviewService } from '../../shared/travel-authority/ta-att-preview.component';
import { ROLE_LABELS } from '../../core/models/user.model';

const MAX_SO = 4 * 1024 * 1024;

// Service Credits: how much leave is left. Everyone sees their own cards and log; the school's
// Administrative Officer (and Publisher AO) keeps the counts for the school's people.
@Component({
  selector: 'app-service-credits',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    @if (personId) {
      @if (sel) { <ng-container *ngTemplateOutlet="person; context: { $implicit: sel, manage: true }"></ng-container> } @else { <p class="muted">{{ error || 'Loading…' }}</p> }
    } @else {
      <ng-container *ngTemplateOutlet="person; context: { $implicit: mine, manage: false }"></ng-container>
    }

    <ng-template #person let-o let-manage="manage">
      @if (!o) { <p class="muted">{{ error || 'Loading…' }}</p> } @else {
        <h3 class="who">{{ manage ? o.user.name : 'My credits' }} <small class="muted">{{ roleName(o.user.role) }}@if (o.user.school) { · {{ o.user.school }} }</small></h3>
        <div class="cards">
          @for (c of o.credits; track c.kind) {
            <div class="card cr" [class.wl]="c.kind === 'wellness'">
              <small>{{ c.label }}</small>
              @if (c.initialSet) { <b>{{ c.balance }}</b><span class="d">{{ c.balance === 1 ? 'day' : 'days' }}</span> } @else { <b class="dash">—</b><span class="d">not set yet</span> }
              @if (c.kind === 'wellness') { <em>Back to 5 every January</em> }
              @if (c.pending) { <em class="warn">Change to {{ c.pending.newBalance }} waits for the Administrator</em> }
              @if (manage && o.canManage) {
                @if (!c.initialSet) {
                  <div class="row"><input type="number" min="0" step="0.5" inputmode="decimal" [(ngModel)]="initial[c.kind]" placeholder="Initial count" aria-label="Initial count" /><button class="btn" type="button" (click)="saveInitial(o, c)" [disabled]="busy">Set</button></div>
                } @else if (!c.pending) {
                  <button class="btn secondary sm" type="button" (click)="startEdit(c)">Request change</button>
                  @if (editKind === c.kind) {
                    <div class="edit">
                      <input type="number" min="0" step="0.5" inputmode="decimal" [(ngModel)]="editBalance" placeholder="New count" aria-label="New count" />
                      <input type="text" [(ngModel)]="editReason" placeholder="Reason (required)" aria-label="Reason" />
                      <div class="row"><button class="btn" type="button" (click)="saveEdit(o, c)" [disabled]="busy">{{ o.isAdmin ? 'Save change' : 'Send to Administrator' }}</button><button class="btn secondary" type="button" (click)="editKind = null">Cancel</button></div>
                      @if (!o.isAdmin) { <small class="muted">A change to a saved count needs the Administrator’s approval.</small> }
                    </div>
                  }
                }
              }
            </div>
          }
        </div>

        @if (manage && o.canManage) {
          <section class="card so">
            <h4>Add credits from a Special Order</h4>
            <div class="grid">
              <label>Credit
                <select [(ngModel)]="soKind">@for (c of soKinds(o); track c.kind) { <option [value]="c.kind">{{ c.label }}</option> }</select></label>
              <label>Days to add<input type="number" min="0.5" step="0.5" inputmode="decimal" [(ngModel)]="soAmount" /></label>
              <label>S.O. number<input type="text" [(ngModel)]="soNumber" placeholder="e.g. 123, s. 2026" /></label>
              <label>Special Order (JPG, PNG or PDF, up to 4 MB)<input type="file" accept="image/jpeg,image/png,application/pdf" (change)="soFile = $any($event.target).files?.[0] ?? null" /></label>
            </div>
            <button class="btn" type="button" (click)="addSo(o)" [disabled]="busy || !soNumber || !soAmount || !soFile || !soKind">{{ busy ? 'Saving…' : 'Add credits' }}</button>
            <small class="muted"> The credit must already have its first count.</small>
          </section>
        }
        @if (msg) { <p class="ok">{{ msg }}</p> } @if (error) { <p class="error">{{ error }}</p> }

        <h4>Log</h4>
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
    </ng-template>
  `,
  styles: [`
    .seg { display: inline-flex; border: 1px solid #d1d5db; border-radius: 999px; overflow: hidden; margin-bottom: 1rem; }
    .seg button { border: 0; background: #fff; padding: .45rem 1rem; font: inherit; cursor: pointer; } .seg .on { background: #166534; color: #fff; }
    .muted { color: #6b7280; } .ok { color: #166534; } .error { color: #b91c1c; }
    .people { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: .6rem; margin-bottom: 1rem; }
    .pcard { text-align: left; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: .6rem .8rem; cursor: pointer; font: inherit; display: flex; flex-direction: column; gap: .15rem; }
    .pcard.on { border-color: #166534; box-shadow: 0 0 0 2px #bbf7d0; } .pcard small { color: #6b7280; }
    .chips { display: flex; flex-wrap: wrap; gap: .25rem; } .chip { background: #f3f4f6; border-radius: 999px; padding: 0 .5rem; font-size: .72rem; } .chip.todo { background: #fef3c7; color: #92400e; }
    .who { margin: .5rem 0; } .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: .7rem; margin-bottom: 1rem; }
    .cr { padding: .8rem 1rem; display: flex; flex-direction: column; gap: .2rem; } .cr small { color: #6b7280; }
    .cr b { font-size: 2rem; line-height: 1.1; color: #166534; } .cr b.dash { color: #9ca3af; } .cr .d { font-size: .8rem; color: #6b7280; } .cr.wl b { color: #0369a1; }
    .cr em { font-size: .75rem; color: #6b7280; font-style: normal; } .cr em.warn { color: #92400e; }
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
  private auth = inject(AuthService);
  private attPreview = inject(TaAttPreviewService);

  @Input() personId = '';
  mine: CreditOverview | null = null;
  sel: CreditOverview | null = null;
  loaded = false; busy = false; msg = ''; error = '';
  initial: Record<string, number | null> = {};
  editKind: string | null = null; editBalance: number | null = null; editReason = '';
  soKind: CreditKind | '' = ''; soAmount: number | null = null; soNumber = ''; soFile: File | null = null;

  roleName(r: string) { return (ROLE_LABELS as Record<string, string>)[r] ?? r; }
  short(k: CreditKind) { return ({ service_credit: 'SC', wellness: 'WL', vl_sl: 'VL/SL', spl: 'SPL', fl: 'FL', cto: 'CTO' } as const)[k]; }
  typeName(l: CreditLog) { return ({ initial: 'Initial count', special_order: 'Special Order', edit: 'Changed', reset: 'Yearly reset', deduction: 'Leave used', restore: 'Restored' } as const)[l.type]; }
  soKinds(o: CreditOverview) { return o.credits.filter((c) => c.kind !== 'wellness' && c.initialSet); }

  ngOnInit() {
    if (this.personId) { firstValueFrom(this.api.user(this.personId)).then((o) => { this.sel = o; this.soKind = this.soKinds(o)[0]?.kind ?? ''; }).catch((e) => (this.error = e?.error?.message ?? 'Could not load the credits.')); return; }
    firstValueFrom(this.api.mine()).then((o) => (this.mine = o)).catch((e) => (this.error = e?.error?.message ?? 'Could not load your credits.'));
  }

  private async refresh(o: CreditOverview) {
    this.sel = o;
    if (o.user.id === this.auth.currentUser()?.id) this.mine = await firstValueFrom(this.api.mine());
  }

  private async run(fn: () => Promise<void>) {
    this.busy = true; this.msg = ''; this.error = '';
    try { await fn(); } catch (e: any) { this.error = e?.error?.message ?? e?.message ?? 'Something went wrong.'; }
    this.busy = false;
  }

  saveInitial(o: CreditOverview, c: CreditCard) {
    const n = this.initial[c.kind];
    if (n == null || n < 0) { this.error = 'Enter the count.'; return; }
    void this.run(async () => { await this.refresh(await firstValueFrom(this.api.setInitial(o.user.id, c.kind, n))); this.msg = `${c.label} set to ${n}.`; });
  }

  startEdit(c: CreditCard) { this.editKind = c.kind; this.editBalance = c.balance; this.editReason = ''; this.msg = ''; this.error = ''; }

  saveEdit(o: CreditOverview, c: CreditCard) {
    if (this.editBalance == null) return;
    void this.run(async () => {
      await this.refresh(await firstValueFrom(this.api.requestEdit(o.user.id, c.kind, this.editBalance!, this.editReason)));
      this.editKind = null;
      this.msg = o.isAdmin ? 'Saved.' : 'Sent to the Administrator for approval.';
    });
  }

  addSo(o: CreditOverview) {
    const f = this.soFile;
    if (!f || !this.soKind || !this.soAmount) return;
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
      await this.refresh(await firstValueFrom(this.api.specialOrder(o.user.id, { kind: this.soKind as CreditKind, amount: this.soAmount!, soNumber: this.soNumber, fileName: f.name, url: body.secure_url, publicId: body.public_id ?? '' })));
      this.msg = `Added ${this.soAmount} to ${o.credits.find((c) => c.kind === this.soKind)?.label}.`;
      this.soAmount = null; this.soNumber = ''; this.soFile = null;
    });
  }

  openSo(l: CreditLog) { void this.attPreview.open('', { id: l.id, name: l.fileName ?? 'Special Order', mime: /\.pdf$/i.test(l.fileUrl ?? '') ? 'application/pdf' : 'image/jpeg', size: 0, url: l.fileUrl }); }
}
