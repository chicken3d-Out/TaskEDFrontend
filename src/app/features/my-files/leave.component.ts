import { Component, ElementRef, Input, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { DriveUploadService } from '../../core/services/drive-upload.service';
import { LEAVE_STATUS, LeaveData, LeaveService, LeaveView } from '../../core/services/leave.service';
import { ServiceCreditsService } from '../../core/services/service-credits.service';
import { ROLE_LABELS } from '../../core/models/user.model';
import { PAGE_W, SIG_W, buildForm6, form6Pdf, suggestKind } from '../../shared/leave/leave-form';
import { blackenPng } from '../../shared/signature/blacken';

const today = () => new Date().toISOString().slice(0, 10);
const blank = (): LeaveData => ({ office: '', lastName: '', firstName: '', middleName: '', filingDate: today(), position: '', salary: '', leaveType: 'Vacation Leave', otherLeave: '', where: '', whereText: '', illness: '', illnessText: '', womenText: '', study: '', monetization: '', days: 1, dates: '', commutation: 'not' });

// My files › Leave (Form 6): apply, sign, approve and send. Credits are deducted when the AO approves
// (or when the School Head approves an AO's own leave) and given back if it is disapproved.
@Component({
  selector: 'app-leave',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    <div class="bar"><button class="btn" type="button" (click)="startNew()">{{ person ? 'Apply leave for ' + firstName() : 'Apply for leave (Form 6)' }}</button></div>
    @if (error && !dlg) { <p class="error">{{ error }}</p> }
    @for (a of list; track a.id) {
      <div class="card item" [class.turn]="a.myTurn">
        <div class="main">
          <strong>{{ a.applicant.name }}</strong> <span class="muted">· {{ a.data.leaveType === 'Others' ? a.data.otherLeave : a.data.leaveType }} · {{ a.days }} day{{ a.days === 1 ? '' : 's' }} · {{ a.data.dates }}</span>
          <div><span class="st" [class.ok]="a.status === 'approved'" [class.no]="a.status === 'disapproved'">{{ statusOf(a) }}</span>
            @if (a.myTurn) { <span class="turnb">{{ turnText(a) }}</span> }
            @if (a.filedBy && a.filedBy.id !== a.applicant.id) { <small class="muted"> · prepared by {{ a.filedBy.name }}</small> }</div>
          @if (a.kindLabel) { <small class="muted">Deducts from {{ a.kindLabel }}{{ a.deducted ? ' · deducted' : '' }}</small> }
        </div>
        <button class="btn secondary" type="button" (click)="open(a.id)">Open</button>
      </div>
    } @empty { <p class="muted">{{ loaded ? 'No leave applications yet.' : 'Loading…' }}</p> }

    @if (dlg === 'form') {
      <div class="bd" (click)="dlg = null"></div>
      <div class="box" role="dialog" aria-modal="true" aria-label="Leave application">
        <h3>{{ editId ? 'Edit leave application' : 'Apply for leave (Form 6)' }}</h3>
        <div class="grid">
          <label>Office/Department<input [(ngModel)]="f.office" /></label>
          <label>Position<input [(ngModel)]="f.position" /></label>
          <label>Last name<input [(ngModel)]="f.lastName" /></label>
          <label>First name<input [(ngModel)]="f.firstName" /></label>
          <label>Middle name<input [(ngModel)]="f.middleName" /></label>
          <label>Salary (optional)<input [(ngModel)]="f.salary" /></label>
          <label>Date of filing<input type="date" [(ngModel)]="f.filingDate" /></label>
          <label>Type of leave<select [(ngModel)]="f.leaveType" (ngModelChange)="typeChanged()">@for (t of types; track t) { <option [value]="t">{{ t }}</option> }</select></label>
          @if (f.leaveType === 'Others') { <label>Others (specify, e.g. Wellness Leave)<input [(ngModel)]="f.otherLeave" /></label> }
          <label>Working days applied for<input type="number" min="0.5" step="0.5" inputmode="decimal" [(ngModel)]="f.days" /></label>
          <label>Inclusive dates<input [(ngModel)]="f.dates" placeholder="e.g. December 3-5, 2026" /></label>
          <label>Commutation<select [(ngModel)]="f.commutation"><option value="not">Not requested</option><option value="requested">Requested</option></select></label>
        </div>
        <details class="more" [open]="f.leaveType !== 'Others'"><summary>More details of the leave (optional)</summary>
        @if (f.leaveType === 'Vacation Leave' || f.leaveType === 'Special Privilege Leave') {
          <div class="grid"><label>Where leave is spent<select [(ngModel)]="f.where"><option value="">—</option><option value="ph">Within the Philippines</option><option value="abroad">Abroad</option></select></label><label>Specify<input [(ngModel)]="f.whereText" /></label></div>
        }
        @if (f.leaveType === 'Sick Leave') {
          <div class="grid"><label>In<select [(ngModel)]="f.illness"><option value="">—</option><option value="hospital">Hospital</option><option value="outpatient">Out patient</option></select></label><label>Illness<input [(ngModel)]="f.illnessText" /></label></div>
        }
        @if (f.leaveType === 'Special Leave Benefits for Women') { <label>Illness<input [(ngModel)]="f.womenText" /></label> }
        @if (f.leaveType === 'Study Leave') { <label>Study leave for<select [(ngModel)]="f.study"><option value="">—</option><option value="masters">Completion of Master's Degree</option><option value="bar">BAR/Board Examination Review</option></select></label> }
        </details>
        @if (kinds.length) {
          <fieldset class="kinds"><legend>Deduct this leave from</legend>
            <label class="rad"><input type="radio" name="kind" [value]="''" [(ngModel)]="kind" /> Nothing (no deduction)</label>
            @for (k of kinds; track k.kind) { <label class="rad"><input type="radio" name="kind" [value]="k.kind" [(ngModel)]="kind" /> {{ k.label }}</label> }
          </fieldset>
        }
        @if (error) { <p class="error">{{ error }}</p> }
        <div class="acts"><button class="btn" type="button" (click)="save()" [disabled]="busy">{{ busy ? 'Saving…' : editId ? 'Save changes' : 'Create and review' }}</button><button class="btn secondary" type="button" (click)="dlg = null">Cancel</button></div>
      </div>
    }

    @if (dlg === 'view' && cur) {
      <div class="bd" (click)="close()"></div>
      <div class="pnl" role="dialog" aria-modal="true" aria-label="Form 6">
        <header>
          <div><h3>Form 6 · {{ cur.applicant.name }}</h3><small class="muted">{{ statusOf(cur) }}</small></div>
          <div class="hb"><button class="btn secondary" type="button" (click)="download()" [disabled]="busy">Download PDF</button><button class="btn secondary" type="button" (click)="close()">Close</button></div>
        </header>
        @if (error) { <p class="error pad">{{ error }}</p> } @if (msg) { <p class="ok pad">{{ msg }}</p> }
        @if (cur.printed.signatoryNote && cur.status !== 'approved') { <p class="muted pad">{{ cur.printed.signatoryNote }}</p> }
        <div class="pad acts2">
          @if (cur.myTurn === 'applicant' || cur.myTurn === 'ao' || cur.myTurn === 'signatory') {
            @if (!cur.signAs) { <span class="error">You have no signature yet. Add one in My profile, then come back.</span> }
            @else { <span class="tip">Tap the form where your signature goes{{ placed ? ' (tap again to move it)' : '' }}.</span> }
          }
          @if (cur.myTurn === 'ao') {
            <label>Deduct from <select [(ngModel)]="aoKind"><option value="">Nothing</option>@for (k of cur.kinds; track k.kind) { <option [value]="k.kind">{{ k.label }}</option> }</select></label>
          }
          @if (cur.myTurn === 'signatory') {
            <label class="rad"><input type="radio" name="dec" value="approval" [(ngModel)]="decision" /> For approval</label>
            <label class="rad"><input type="radio" name="dec" value="disapproval" [(ngModel)]="decision" /> For disapproval</label>
          }
          @if (cur.myTurn === 'ao' || (cur.myTurn === 'signatory' && decision === 'disapproval')) { <input class="why" [(ngModel)]="reason" placeholder="Reason (needed to disapprove)" aria-label="Reason" /> }
          @if (placed && cur.myTurn && cur.myTurn !== 'send') {
            <button class="btn" type="button" (click)="doSign()" [disabled]="busy">{{ busy ? 'Saving…' : signLabel() }}</button>
          }
          @if (cur.myTurn === 'ao') { <button class="btn secondary" type="button" (click)="disapprove()" [disabled]="busy || !reason">Disapprove</button> }
          @if (cur.myTurn === 'send') { <button class="btn" type="button" (click)="send()" [disabled]="busy">Send to {{ cur.printed.signatoryTitle }} for signature</button> }
          @if (cur.status === 'awaiting_applicant' && (cur.applicant.id === me?.id || cur.filedBy?.id === me?.id)) {
            <button class="btn secondary" type="button" (click)="startEdit()">Edit</button><button class="btn secondary" type="button" (click)="remove()" [disabled]="busy">Delete</button>
          }
        </div>
        <div class="scroll" #scroll><div class="host" #host></div></div>
      </div>
    }
  `,
  styles: [`
    .bar { margin-bottom: 1rem; } .muted { color: #6b7280; } .ok { color: #166534; } .error { color: #b91c1c; }
    .item { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: .8rem 1rem; margin-bottom: .6rem; } .item.turn { border-left: 4px solid #16a34a; }
    .st { display: inline-block; font-size: .75rem; background: #fef3c7; color: #92400e; border-radius: 999px; padding: 0 .55rem; } .st.ok { background: #dcfce7; color: #166534; } .st.no { background: #fee2e2; color: #991b1b; }
    .turnb { font-size: .75rem; background: #166534; color: #fff; border-radius: 999px; padding: 0 .55rem; margin-left: .3rem; }
    .bd { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 1200; }
    .box { position: fixed; z-index: 1201; inset: 0; margin: auto; width: min(720px, 100%); max-height: 100dvh; height: fit-content; overflow: auto; background: #fff; border-radius: 12px; padding: 1.2rem; }
    .box h3 { margin: 0 0 .8rem; } .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: .6rem; margin: .6rem 0; }
    label { display: flex; flex-direction: column; gap: .2rem; font-size: .82rem; font-weight: 600; } input, select { padding: .45rem .55rem; border: 1px solid #d1d5db; border-radius: 8px; font: inherit; font-weight: 400; min-width: 0; }
    .kinds { border: 1px solid #e5e7eb; border-radius: 8px; padding: .5rem .8rem; margin: .6rem 0; } .rad { flex-direction: row; align-items: center; gap: .4rem; font-weight: 400; } .rad input { width: auto; }
    .acts { display: flex; gap: .5rem; margin-top: .8rem; } .more { margin: .4rem 0; } .more summary { cursor: pointer; color: #166534; font-size: .85rem; }
    .pnl { position: fixed; z-index: 1201; inset: 0; margin: auto; width: min(960px, 100%); height: min(100%, 100dvh); background: #f3f4f6; display: flex; flex-direction: column; }
    .pnl header { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; padding: .8rem 1.1rem; background: #fff; border-bottom: 1px solid #e5e7eb; } .pnl h3 { margin: 0; font-size: 1.05rem; } .hb { display: flex; gap: .5rem; }
    .pad { padding: .5rem 1.1rem; margin: 0; background: #fff; } .acts2 { display: flex; gap: .6rem; flex-wrap: wrap; align-items: center; } .tip { color: #166534; } .why { min-width: 14rem; }
    .scroll { flex: 1; overflow: auto; padding: .8rem; } .host { width: max-content; margin: 0 auto; }
    :host ::ng-deep .host .pg { cursor: crosshair; box-shadow: 0 2px 10px rgba(0,0,0,.2); }
  `],
})
export class LeaveComponent implements OnInit {
  private api = inject(LeaveService);
  private creditsApi = inject(ServiceCreditsService);
  private auth = inject(AuthService);
  @ViewChild('host') host?: ElementRef<HTMLElement>;
  @ViewChild('scroll') scroll?: ElementRef<HTMLElement>;

  @Input() person: { id: string; name: string; position?: string; station?: string } | null = null;
  me = this.auth.currentUser();
  list: LeaveView[] = []; types: string[] = []; loaded = false;
  dlg: 'form' | 'view' | null = null;
  cur: LeaveView | null = null; editId = ''; personId = '';
  f: LeaveData = blank(); kind = ''; kinds: { kind: string; label: string }[] = [];
  busy = false; error = ''; msg = '';
  placed = false; private pos: { x: number; y: number } | null = null;
  aoKind = ''; decision: 'approval' | 'disapproval' = 'approval'; reason = '';

  firstName() { return (this.person?.name ?? '').split(' ')[0]; }
  roleName(r: string) { return (ROLE_LABELS as Record<string, string>)[r] ?? r; }
  statusOf(a: LeaveView) { return LEAVE_STATUS[a.status]; }
  turnText(a: LeaveView) { return ({ applicant: 'Your signature', ao: 'Your approval', send: 'Send it on', signatory: 'Your signature' } as const)[a.myTurn!]; }
  signLabel() { return this.cur?.myTurn === 'ao' ? 'Sign and approve' : this.cur?.myTurn === 'signatory' ? 'Sign' : 'Sign'; }

  async ngOnInit() {
    try { this.types = await firstValueFrom(this.api.types()); } catch { this.types = []; }
    await this.reload();
  }

  async reload() {
    try { const all = await firstValueFrom(this.api.list()); this.list = this.person ? all.filter((x) => x.applicant.id === this.person!.id) : all; this.error = ''; } catch (e: any) { this.error = e?.error?.message ?? 'Could not load your leave applications.'; }
    this.loaded = true;
  }

  // ---------- form ----------
  private fillFor(name: { last: string; first: string; middle: string }, school: string, position: string) {
    this.f = { ...blank(), lastName: name.last, firstName: name.first, middleName: name.middle, office: school, position };
  }

  async startNew() {
    this.error = ''; this.editId = '';
    const u = this.me;
    if (this.person) {
      this.personId = this.person.id;
      const parts = this.person.name.split(' ');
      this.fillFor({ last: parts.length > 1 ? parts[parts.length - 1] : this.person.name, first: parts.slice(0, -1).join(' '), middle: '' }, (u as any)?.school?.name ?? '', this.person.position ?? '');
    } else {
      this.personId = u?.id ?? '';
      this.fillFor({ last: u?.lastName ?? '', first: u?.firstName ?? '', middle: u?.middleName ?? '' }, (u as any)?.school?.name ?? '', (u as any)?.designation ?? '');
    }
    this.kind = '';
    await this.loadKinds(this.personId);
    this.dlg = 'form';
  }

  private async loadKinds(id: string) {
    try {
      const o = id === this.me?.id ? await firstValueFrom(this.creditsApi.mine()) : await firstValueFrom(this.creditsApi.user(id));
      this.kinds = o.credits.map((c) => ({ kind: c.kind, label: c.label }));
    } catch { this.kinds = []; }
    this.typeChanged();
  }

  typeChanged() { this.kind = suggestKind(this.f.leaveType, this.kinds.map((k) => k.kind)); }

  async save() {
    this.busy = true; this.error = '';
    try {
      const body = { data: this.f, kind: this.kind || null };
      const v = this.editId ? await firstValueFrom(this.api.update(this.editId, body)) : await firstValueFrom(this.api.create({ ...body, applicantId: this.personId && this.personId !== this.me?.id ? this.personId : undefined }));
      await this.reload();
      this.dlg = null;
      await this.show(v);
    } catch (e: any) { this.error = e?.error?.message ?? 'Could not save.'; }
    this.busy = false;
  }

  startEdit() {
    if (!this.cur) return;
    this.editId = this.cur.id; this.f = { ...this.cur.data }; this.kind = this.cur.kind ?? ''; this.kinds = this.cur.kinds; this.error = ''; this.dlg = 'form';
  }

  async remove() {
    if (!this.cur || !confirm('Delete this application?')) return;
    this.busy = true;
    try { await firstValueFrom(this.api.remove(this.cur.id)); this.close(); await this.reload(); } catch (e: any) { this.error = e?.error?.message ?? 'Could not delete.'; }
    this.busy = false;
  }

  // ---------- viewer ----------
  async open(id: string) { this.error = ''; try { await this.show(await firstValueFrom(this.api.get(id))); } catch (e: any) { this.error = e?.error?.message ?? 'Could not open it.'; } }

  private async show(v: LeaveView) {
    this.cur = v; this.dlg = 'view'; this.msg = ''; this.error = ''; this.pos = null; this.placed = false; this.reason = ''; this.decision = 'approval'; this.aoKind = v.kind ?? '';
    await this.paint();
  }

  private async paint() {
    const v = this.cur!;
    await new Promise((r) => setTimeout(r));
    const host = this.host?.nativeElement; if (!host) return;
    const page = await buildForm6(v);
    host.innerHTML = ''; host.appendChild(page);
    if (v.signAs && v.myTurn && v.myTurn !== 'send') {
      let ghost: HTMLImageElement | null = null;
      page.addEventListener('click', async (e) => {
        const r = page.getBoundingClientRect();
        this.pos = { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
        ghost?.remove();
        ghost = document.createElement('img'); ghost.className = 'tasig ghost'; ghost.src = await blackenPng(v.signAs!);
        ghost.style.left = `${this.pos.x * 100}%`; ghost.style.top = `${this.pos.y * 100}%`; ghost.style.width = `${SIG_W}px`;
        page.appendChild(ghost); this.placed = true;
      });
    }
    const avail = (this.scroll?.nativeElement.clientWidth ?? 800) - 16;
    host.style.zoom = String(avail < PAGE_W && avail > 200 ? avail / PAGE_W : 1);
  }

  private async apply(p: Promise<LeaveView>, ok: string) {
    this.busy = true; this.error = '';
    try { this.cur = await p; this.msg = ok; this.pos = null; this.placed = false; await this.reload(); await this.paint(); }
    catch (e: any) { this.error = e?.error?.message ?? e?.message ?? 'Something went wrong.'; }
    this.busy = false;
  }

  doSign() {
    const v = this.cur; if (!v || !this.pos) return;
    const body: any = { x: this.pos.x, y: this.pos.y };
    if (v.myTurn === 'ao') body.kind = this.aoKind || null;
    if (v.myTurn === 'signatory') { body.decision = this.decision; body.reason = this.reason; }
    void this.apply(firstValueFrom(this.api.sign(v.id, body)), v.myTurn === 'applicant' ? 'Signed.' : v.myTurn === 'ao' ? 'Approved and signed. Press “Send” to pass it on.' : 'Signed.');
  }
  disapprove() { if (this.cur) void this.apply(firstValueFrom(this.api.disapprove(this.cur.id, this.reason)), 'Disapproved.'); }
  send() { if (this.cur) void this.apply(firstValueFrom(this.api.send(this.cur.id)), `Sent to the ${this.cur.printed.signatoryTitle}.`); }

  async download() {
    const page = this.host?.nativeElement.querySelector('.pg') as HTMLElement | null;
    if (!page || !this.cur) return;
    this.busy = true; this.error = '';
    try { DriveUploadService.saveBlob(await form6Pdf(page), `Form 6 - ${this.cur.applicant.name}.pdf`); } catch (e: any) { this.error = e?.message ?? 'Could not build the file.'; }
    this.busy = false;
  }

  close() { this.dlg = null; this.cur = null; void this.reload(); }
}
