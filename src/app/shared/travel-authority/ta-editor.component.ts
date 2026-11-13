import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { DriveUploadService } from '../../core/services/drive-upload.service';
import { TaAttachment, TaForm, TaRecord, TaRoute, TravelAuthorityService } from '../../core/services/travel-authority.service';
import { TaEditorService } from './ta-editor.service';
import { TaSignService } from './ta-sign.service';
import { syncToDrive } from './ta-doc';
import { TaAttPreviewService } from './ta-att-preview.component';
import { TA_ATTACH_MAX, TA_ATTACH_TYPES, uploadTaAttachment } from './ta-attach';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function rangeText(from: string, to: string): string {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(from), b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(to || from);
  if (!a || !b) return '';
  const [ya, ma, da] = [+a[1], +a[2] - 1, +a[3]], [yb, mb, db] = [+b[1], +b[2] - 1, +b[3]];
  if (ya === yb && ma === mb && da === db) return `${MONTHS[ma]} ${da}, ${ya}`;
  if (ya === yb && ma === mb) return `${MONTHS[ma]} ${da}-${db}, ${ya}`;
  if (ya === yb) return `${MONTHS[ma]} ${da} - ${MONTHS[mb]} ${db}, ${ya}`;
  return `${MONTHS[ma]} ${da}, ${ya} - ${MONTHS[mb]} ${db}, ${yb}`;
}
const EMPTY: TaForm = { name: '', position: '', station: '', purpose: '', host: '', dates: '', destination: '', fund: '', dateFrom: '', dateTo: '' };

@Component({
  selector: 'app-ta-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (svc.current(); as req) {
      <div class="backdrop" (click)="tryClose()"></div>
      <div class="panel" role="dialog" aria-modal="true" aria-label="Apply Travel Authority">
        <header>
          <div>
            <h2>{{ rec ? 'Edit Travel Authority' : 'Apply Travel Authority' }}</h2>
            <small>{{ forName() ? 'For ' + forName() + ' · ' : '' }}DepEd Order No. 043, s. 2022</small>
          </div>
          <div class="hbtns">
            <button class="btn secondary" type="button" (click)="preview()" [disabled]="!ready">Preview</button>
            <button class="btn secondary" type="button" (click)="save('draft')" [disabled]="busy || !ready">{{ busy ? 'Saving…' : 'Save draft' }}</button>
            @if (isSelf()) { <button class="btn" type="button" (click)="save('sign')" [disabled]="busy || !ready">Save &amp; sign</button> }
            @else { <button class="btn" type="button" (click)="save('send')" [disabled]="busy || !ready">Save &amp; send to {{ firstName() }} to sign</button> }
            <button class="btn secondary" type="button" (click)="tryClose()">Close</button>
          </div>
        </header>
        @if (error) { <p class="error pad">{{ error }}</p> }
        @if (msg) { <p class="ok pad">{{ msg }}</p> }
        @if (ready) {
          <div class="body">
            <h3>Travel details</h3>
            <div class="grid">
              <label>Name<input name="name" [(ngModel)]="f.name" (ngModelChange)="touch()" /></label>
              <label>Position / Designation<input name="position" [(ngModel)]="f.position" (ngModelChange)="touch()" /></label>
              <label class="wide">Permanent station<input name="station" [(ngModel)]="f.station" (ngModelChange)="touch()" /></label>
              <label class="wide">Purpose of travel (must be supported by attachments)<textarea rows="2" name="purpose" [(ngModel)]="f.purpose" (ngModelChange)="touch()"></textarea></label>
              <label>Host of activity<input name="host" [(ngModel)]="f.host" (ngModelChange)="touch()" /></label>
              <label>Fund source<input name="fund" [(ngModel)]="f.fund" (ngModelChange)="touch()" placeholder="e.g. Local Funds / Local MOOE" /></label>
              <label>Travel from<input type="date" name="from" [(ngModel)]="f.dateFrom" [max]="f.dateTo || null" (ngModelChange)="dates()" /></label>
              <label>Travel to<input type="date" name="to" [(ngModel)]="f.dateTo" [min]="f.dateFrom || null" (ngModelChange)="dates()" /></label>
              @if (badDates()) { <p class="error wide">The end date cannot be before the start date.</p> }
              <label class="wide">Inclusive dates (as printed on the form)<input name="dates" [(ngModel)]="f.dates" (ngModelChange)="manualDates = true; touch()" placeholder="e.g. May 21, 26, 28, 2026" /></label>
              <label class="wide">Destination<input name="destination" [(ngModel)]="f.destination" (ngModelChange)="touch()" /></label>
            </div>
            <label class="chk"><input type="checkbox" name="outside" [(ngModel)]="outside" (ngModelChange)="routeChanged()" /> Travel is <strong>outside</strong> the Schools Division of Leyte</label>
            <p class="muted">Leave it unticked for travel within the Division.</p>

            <h3>Signatories</h3>
            <div class="route">
              <div><small>Requesting employee</small><strong>{{ f.name || '—' }}</strong></div>
              @if (route?.countersign) { <div><small>Countersigned first by (School Head)</small><strong>{{ route!.countersign!.name || '—' }}</strong>@if (route!.countersign!.note) { <em>{{ route!.countersign!.note }}</em> }</div> }
              <div><small>Recommending authority</small><strong>{{ route?.recommending?.name || '—' }}</strong>@if (route?.recommending?.note) { <em>{{ route!.recommending!.note }}</em> }</div>
              <div><small>Approving authority{{ route?.approvingByEmail ? ' (not e-signed)' : '' }}</small><strong>{{ route?.approving?.name || '—' }}</strong>@if (route?.approving?.note) { <em>{{ route!.approving.note }}</em> }</div>
            </div>
            <p class="muted">Chosen for you from your role and the destination. Each e-signing authority taps the form to place their signature, in turn. @if (route?.approvingByEmail) { Authorities who do not e-sign are printed names only: when the signing is done, you email the signed form and your attachments to the Travel Authority mailbox (travel.authority&#64;deped.gov.ph). }</p>

            <h3>Attachments <span class="muted">(optional)</span></h3>
            <p class="muted">Supporting documents such as the memorandum or invitation. JPG, PNG or PDF, up to 5 files, 4 MB each. They are kept in the cloud and can be previewed inside TaskEd. The signers can open them, and they are emailed with the signed form for travel outside the Division.</p>
            @for (a of saved; track a.id) {
              <div class="att"><span><a href="javascript:void(0)" (click)="viewSaved(a)">{{ a.name }}</a> <small class="muted">({{ kb(a.size) }})</small></span><button type="button" class="btn secondary" (click)="dropSaved(a)">Remove</button></div>
            }
            @for (p of pending; track $index) {
              <div class="att"><span>{{ p.name }} <small class="muted">({{ kb(p.size) }}) – attaches when you save</small></span><button type="button" class="btn secondary" (click)="pending.splice($index, 1); touch()">Remove</button></div>
            }
            @if (saved.length + pending.length < 5) { <label class="btn secondary pick">Add attachment<input type="file" hidden multiple accept="image/jpeg,image/png,application/pdf" (change)="addFiles($event)" /></label> }
          </div>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: contents; }
    .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 1100; }
    .panel { position: fixed; z-index: 1101; inset: 0 0 0 auto; width: min(820px, 100%); background: #fff; display: flex; flex-direction: column; overflow: hidden; }
    header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; padding: 1rem 1.2rem; border-bottom: 1px solid #e5e7eb; flex-wrap: wrap; }
    header h2 { margin: 0; } header small { color: #6b7280; }
    .hbtns { display: flex; gap: .5rem; flex-wrap: wrap; }
    .body { padding: 1rem 1.2rem 3rem; overflow-y: auto; flex: 1; }
    .pad { padding: .6rem 1.2rem 0; margin: 0; }
    h3 { margin: 1.2rem 0 .4rem; font-size: 1rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: .6rem .8rem; }
    label { display: flex; flex-direction: column; gap: .2rem; font-size: .82rem; font-weight: 600; }
    label.wide { grid-column: 1 / -1; }
    label.chk { flex-direction: row; align-items: center; gap: .5rem; font-weight: 400; font-size: .92rem; margin-top: .9rem; }
    input:not([type=checkbox]), textarea { padding: .5rem .6rem; border: 1px solid #d1d5db; border-radius: 8px; font: inherit; font-weight: 400; }
    .route { display: grid; gap: .5rem; } .route div { display: flex; flex-direction: column; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: .5rem .8rem; }
    .route small { color: #6b7280; } .route em { color: #b45309; font-size: .82rem; }
    .att a { color: #15803d; }
    .att { display: flex; align-items: center; justify-content: space-between; gap: .6rem; padding: .35rem 0; border-bottom: 1px solid #f3f4f6; } .pick { cursor: pointer; display: inline-block; margin-top: .5rem; }
    .muted { color: #6b7280; font-size: .85rem; } .ok { color: #166534; } .error { color: #b91c1c; }
  `],
})
export class TaEditorComponent {
  svc = inject(TaEditorService);
  private api = inject(TravelAuthorityService);
  private auth = inject(AuthService);
  private drive = inject(DriveUploadService);
  private sign = inject(TaSignService);
  private attPreview = inject(TaAttPreviewService);

  f: TaForm = { ...EMPTY };
  outside = false;
  rec: TaRecord | null = null;
  route: TaRoute | null = null;
  ready = false;
  busy = false;
  error = '';
  msg = '';
  manualDates = false;
  dirty = signal(false);
  saved: TaAttachment[] = [];
  pending: File[] = [];

  constructor() {
    effect(() => {
      const r = this.svc.current();
      this.saved = []; this.pending = [];
      this.rec = null; this.ready = false; this.error = ''; this.msg = ''; this.route = null; this.manualDates = false; this.dirty.set(false);
      if (!r) return;
      if (r.record) {
        this.rec = r.record;
        this.f = { ...EMPTY, ...r.record.data };
        this.outside = r.record.outside;
        this.manualDates = !!r.record.data.dates;
        firstValueFrom(this.api.get(r.record.id)).then((x) => (this.saved = x.attachments ?? [])).catch(() => {});
      } else {
        const u = this.auth.currentUser();
        if (r.forTeacher) this.f = { ...EMPTY, name: r.forTeacher.name, position: r.forTeacher.position, station: r.forTeacher.station };
        else {
          const mi = u?.middleName?.trim() ? u.middleName.trim()[0].toUpperCase() + '. ' : '';
          const name = u?.lastName ? `${u.firstName ?? ''} ${mi}${u.lastName}`.trim() : (u?.name ?? '');
          const sch = u?.school ?? u?.assignedSchools?.[0];
          const school = sch?.name ?? '';
          this.f = { ...EMPTY, name: name.toUpperCase(), position: u?.designation ?? '', station: school ? `DepEd Leyte Division / ${school}${sch?.district ? ' ' + (/district\s*$/i.test(sch.district) ? sch.district : sch.district + ' District') : ''}` : 'DepEd Leyte Division' };
        }
        this.outside = false;
      }
      this.ready = true;
      this.loadRoute();
    }, { allowSignalWrites: true });
  }

  forName() { const r = this.svc.current(); return r?.forTeacher?.name ?? (this.rec && this.rec.requesterId !== this.auth.currentUser()?.id ? this.rec.requesterName : ''); }
  isSelf() { const r = this.svc.current(); return !(r?.forTeacher || (this.rec && this.rec.requesterId !== this.auth.currentUser()?.id)); }
  firstName() { return (this.forName() || '').split(' ')[0] || 'the employee'; }
  private requesterId() { const r = this.svc.current(); return r?.forTeacher?.id ?? (this.rec && this.rec.requesterId !== this.auth.currentUser()?.id ? this.rec.requesterId : undefined); }

  loadRoute() {
    firstValueFrom(this.api.route(this.outside, this.requesterId())).then((r) => (this.route = r)).catch(() => (this.route = null));
  }
  kb(n: number) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  addFiles(ev: Event) {
    const input = ev.target as HTMLInputElement;
    this.error = '';
    for (const f of Array.from(input.files ?? [])) {
      if (this.saved.length + this.pending.length >= 5) { this.error = 'At most 5 attachments.'; break; }
      if (!TA_ATTACH_TYPES.includes(f.type)) { this.error = `${f.name}: only JPG, PNG or PDF files.`; continue; }
      if (f.size > TA_ATTACH_MAX) { this.error = `${f.name} is bigger than 4 MB.`; continue; }
      this.pending.push(f);
    }
    input.value = '';
    this.touch();
  }
  async dropSaved(a: TaAttachment) {
    if (!this.rec) return;
    try { this.saved = await firstValueFrom(this.api.removeAttachment(this.rec.id, a.id)); } catch (e: any) { this.error = e?.error?.message ?? 'Could not remove it.'; }
  }
  private async uploadPending(id: string) {
    for (const f of [...this.pending]) {
      this.saved = await uploadTaAttachment(this.api, id, f);
      this.pending.splice(this.pending.indexOf(f), 1);
    }
  }
  viewSaved(a: TaAttachment) { if (this.rec) void this.attPreview.open(this.rec.id, a); }
  preview() {
    const r = this.route;
    const draft = {
      id: '', status: 'draft', outside: this.outside, data: { ...this.f },
      countersignName: r?.countersign?.name ?? '', recommendingName: r?.recommending?.name ?? '', approvingName: r?.approving?.name ?? '',
      approvingByEmail: !!r?.approvingByEmail, sigs: this.rec?.sigs ?? undefined, myTurn: null, attachments: [],
      requesterName: this.f.name, ownerName: '', isOwner: true,
    } as unknown as TaRecord;
    this.sign.preview(draft);
  }
  routeChanged() { this.touch(); this.loadRoute(); }
  touch() { this.dirty.set(true); this.msg = ''; }
  badDates() { return !!(this.f.dateFrom && this.f.dateTo && this.f.dateTo < this.f.dateFrom); }
  dates() { if (!this.manualDates) this.f.dates = rangeText(this.f.dateFrom, this.f.dateTo); this.touch(); }

  async save(then: 'draft' | 'sign' | 'send') {
    this.error = ''; this.msg = '';
    if (!this.f.name.trim() || !this.f.purpose.trim() || !this.f.destination.trim()) { this.error = 'Please fill in the name, purpose of travel and destination.'; return; }
    if (this.badDates()) { this.error = 'The end date cannot be before the start date.'; return; }
    this.busy = true;
    try {
      const body = { data: this.f, outside: this.outside };
      const fresh = this.rec
        ? await firstValueFrom(this.api.update(this.rec.id, body))
        : await firstValueFrom(this.api.create({ ...body, forTeacherId: this.svc.current()?.forTeacher?.id }));
      this.rec = fresh;
      await this.uploadPending(fresh.id);
      this.dirty.set(false);
      let latest = fresh;
      if (then === 'send') latest = await firstValueFrom(this.api.send(fresh.id));
      this.api.bump();
      // keep the single soft copy in the owner's Drive up to date
      try { latest = await syncToDrive(this.drive, this.api, this.auth.currentUser()?.depedEmail, latest); this.api.bump(); }
      catch (e: any) { this.msg = `Saved. Your Drive copy was not updated (${e?.message ?? 'error'}); it will update next time you open the log.`; }
      if (then === 'sign') { this.svc.close(); this.sign.open(latest.id); }
      else if (then === 'send') { this.svc.close(); }
      else { this.msg = this.msg || 'Draft saved to your Google Drive (as a PDF).'; }
    } catch (e: any) {
      this.error = e?.error?.message ?? e?.message ?? 'Could not save.';
    }
    this.busy = false;
  }

  tryClose() {
    if (this.dirty() && !confirm('You have unsaved changes. Close without saving?')) return;
    this.svc.close();
  }
}
