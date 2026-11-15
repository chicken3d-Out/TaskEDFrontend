import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { DriveUploadService } from '../../core/services/drive-upload.service';
import { LEAVE_STATUS, LeaveData, LeaveService, LeaveView } from '../../core/services/leave.service';
import { ServiceCreditsService } from '../../core/services/service-credits.service';
import { ROLE_LABELS } from '../../core/models/user.model';
import { PAGE_W, SIG_FRAC, SIG_MAX, buildForm6, buildForm6Back, form6Pdf, suggestKind } from '../../shared/leave/leave-form';
import { PAPERS, loadPaper, paperOf, printPdf, savePaper } from '../../shared/print/paper';
import { blackenPng } from '../../shared/signature/blacken';

const today = () => new Date().toISOString().slice(0, 10);
const blank = (): LeaveData => ({ office: '', lastName: '', firstName: '', middleName: '', filingDate: today(), position: '', salary: '', leaveType: 'Vacation Leave', otherLeave: '', where: '', whereText: '', illness: '', illnessText: '', womenText: '', study: '', monetization: '', days: 1, dates: '', commutation: 'not' });

// Leave (Form 6): apply, sign, and the corresponding signatory approves. Credits are deducted only
// when the corresponding signatory approves it.
import { LoadingComponent } from '../../shared/loading/loading.component';

import { IconComponent } from '../../shared/icon/icon.component';

@Component({
  selector: 'app-leave',
  standalone: true,
  imports: [IconComponent, LoadingComponent, CommonModule, FormsModule, DatePipe],
  template: `
    @if (!hideBar) { <div class="bar"><button class="btn" type="button" (click)="startNew()"><app-icon name="plus" [size]="16" /> {{ person ? 'Apply leave for ' + firstName() : 'Apply for leave (Form 6)' }}</button></div> }
    @if (error && !dlg) { <p class="error">{{ error }}</p> }
    @for (a of list; track a.id) {
      <div class="card item" [class.turn]="a.myTurn">
        <span class="ico"><app-icon name="file-text" [size]="20" /></span>
        <div class="main">
          <strong>{{ a.applicant.name }}</strong> <span class="muted">· {{ a.data.leaveType === 'Others' ? a.data.otherLeave : a.data.leaveType }} · {{ a.days }} day{{ a.days === 1 ? '' : 's' }} · {{ a.data.dates }}</span>
          <div><span class="st" [class.ok]="a.status === 'approved'" [class.no]="a.status === 'disapproved'">{{ statusOf(a) }}</span>
            @if (a.myTurn) { <span class="turnb">{{ turnText(a) }}</span> }
            @if (a.filedBy && a.filedBy.id !== a.applicant.id) { <small class="muted"> · prepared by {{ a.filedBy.name }}</small> }</div>
          @if (a.kindLabel) { <small class="muted">Deducts from {{ a.kindLabel }}{{ a.deducted ? ' · deducted' : '' }}</small> }
        </div>
        <div class="cb">
          <button class="btn secondary" type="button" (click)="open(a.id)" [disabled]="!!openingId">@if (openingId === a.id) { <span class="spin"></span> } @else { <app-icon name="eye" [size]="16" /> } Open</button>
          <button class="btn secondary" type="button" (click)="downloadCard(a)" [disabled]="busy">@if (busy && busyId === a.id) { <span class="spin"></span> } @else { <app-icon name="download" [size]="16" /> } Download</button>
          @if (a.applicant.id === me?.id || a.filedBy?.id === me?.id) { <button class="btn secondary danger" type="button" (click)="removeCard(a)" [disabled]="busy"><app-icon name="trash" [size]="16" /> Delete</button> }
        </div>
      </div>
    } @empty { @if (loaded) { <p class="muted">{{ pendingOnly ? 'No leave applications are waiting for your signature.' : 'No leave applications yet.' }}</p> } @else { <app-loading [compact]="true" label="Loading leave applications…" /> } }

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
          <label>Type of leave<select [(ngModel)]="f.leaveType" (ngModelChange)="typeChanged()">@for (t of types; track t) { <option [value]="t">{{ t }}</option> }</select></label>
          @if (f.leaveType === 'Others') { <label>Others: type the leave (e.g. Wellness Leave)<input [(ngModel)]="f.otherLeave" /></label> }
          <label>Working days applied for<input type="number" min="0.5" step="0.5" inputmode="decimal" [(ngModel)]="f.days" /></label>
          <label>Inclusive dates<input [(ngModel)]="f.dates" placeholder="e.g. December 3-5, 2026" /></label>
        </div>
        <details class="more" [open]="f.leaveType === 'Sick Leave' || f.leaveType === 'Study Leave' || f.leaveType === 'Special Leave Benefits for Women'"><summary>More details of the leave (optional)</summary>
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
          <div class="hb"><select class="paper" [ngModel]="paperId" (ngModelChange)="setPaper($event)" aria-label="Paper size">@for (p of papers; track p.id) { <option [value]="p.id">{{ p.label }}</option> }</select><button class="btn secondary" type="button" (click)="print()" [disabled]="busy">Print</button><button class="btn secondary" type="button" (click)="close()">Close</button></div>
        </header>
        @if (error) { <p class="error pad">{{ error }}</p> } @if (msg) { <p class="ok pad">{{ msg }}</p> }
        @if (cur.printed.signatoryNote && cur.status !== 'approved') { <p class="muted pad">{{ cur.printed.signatoryNote }}</p> }
        <div class="pad acts2">
          @if (cur.myTurn) {
            @if (!cur.signAs) { <span class="error">You have no signature yet. Add one in My profile, then come back.</span> }
            @else { <span class="tip">Tap the form where your signature goes{{ placed ? ' (tap again to move it)' : '' }}.</span> }
          }
          @if (cur.myTurn === 'signatory') {
            <label class="rad"><input type="radio" name="dec" value="approval" [(ngModel)]="decision" /> For approval</label>
            <label class="rad"><input type="radio" name="dec" value="disapproval" [(ngModel)]="decision" /> For disapproval</label>
            @if (decision === 'disapproval') { <input class="why" [(ngModel)]="reason" placeholder="Reason (needed to disapprove)" aria-label="Reason" /> }
          }
          @if (placed && cur.myTurn) {
            <label class="rs">Signature size <input type="range" [min]="sizeMin" [max]="sizeMax" step="5" [ngModel]="sizePct" (ngModelChange)="resize($event)" aria-label="Signature size" /> <span>{{ sizePct }}%</span></label>
            <button class="btn" type="button" (click)="doSign()" [disabled]="busy || (decision === 'disapproval' && cur.myTurn === 'signatory' && !reason)">{{ busy ? 'Saving…' : cur.myTurn === 'signatory' ? 'Sign and ' + (decision === 'approval' ? 'approve' : 'disapprove') : 'Sign and send to ' + cur.printed.signatoryTitle }}</button>
          }
          @if (cur.status === 'awaiting_applicant' && (cur.applicant.id === me?.id || cur.filedBy?.id === me?.id)) { <button class="btn secondary" type="button" (click)="startEdit()">Edit</button> }

        </div>
        <div class="scroll" #scroll>
          @if (painting || busy) { <div class="wait"><span class="spin"></span><span>{{ busy ? 'Working on it…' : 'Laying out the form…' }}</span></div> }
          <div class="host" #host></div>
          @if (cur.events.length) {
            <div class="hist"><h4>History</h4>
              @for (e of cur.events; track $index) { <div class="ev"><span class="when">{{ e.at | date: 'MMM d, y, h:mm a' }}</span> {{ e.text }}</div> }
              @if (cur.deducted && cur.credit) { <div class="ev muted">Credit deducted from {{ cur.credit.label }} only after the signatory approved.</div> }
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .ico { flex: none; width: 40px; height: 40px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; background: var(--primary-soft); color: var(--primary); } .main { flex: 1; min-width: 0; }
    @media (max-width: 560px) { .item { flex-wrap: wrap; padding: .7rem; } .cb { width: 100%; justify-content: flex-start; } .pnl header { padding: .6rem .7rem; } .hb { flex-wrap: wrap; width: 100%; } .hb .paper { flex: 1 1 100%; } .box { padding: .9rem; } }
    .cb { display: flex; gap: .4rem; flex-wrap: wrap; justify-content: flex-end; } .danger { color: var(--err-fg); border-color: #fca5a5; }
    .bar { margin-bottom: 1rem; } .muted { color: var(--muted); } .ok { color: var(--ok-fg); } .error { color: var(--err-fg); }
    .item { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: .8rem 1rem; margin-bottom: .6rem; } .item.turn { border-left: 4px solid #16a34a; }
    .st { display: inline-block; font-size: .75rem; background: var(--warn-bg); color: var(--warn-fg); border-radius: 999px; padding: 0 .55rem; } .st.ok { background: var(--ok-bg); color: var(--ok-fg); } .st.no { background: var(--err-bg); color: var(--err-fg); }
    .turnb { font-size: .75rem; background: #166534; color: #fff; border-radius: 999px; padding: 0 .55rem; margin-left: .3rem; }
    .bd { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 1200; }
    .box { position: fixed; z-index: 1201; inset: 0; margin: auto; width: min(720px, 100%); max-height: 100dvh; height: fit-content; overflow: auto; background: var(--surface); border-radius: 12px; padding: 1.2rem; }
    .box h3 { margin: 0 0 .8rem; } .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: .6rem; margin: .6rem 0; }
    label { display: flex; flex-direction: column; gap: .2rem; font-size: .82rem; font-weight: 600; } input, select { padding: .45rem .55rem; border: 1px solid var(--border-strong); border-radius: 8px; font: inherit; font-weight: 400; min-width: 0; }
    .kinds { border: 1px solid var(--border); border-radius: 8px; padding: .5rem .8rem; margin: .6rem 0; } .rad { flex-direction: row; align-items: center; gap: .4rem; font-weight: 400; } .rad input { width: auto; }
    .acts { display: flex; gap: .5rem; margin-top: .8rem; } .more { margin: .4rem 0; } .more summary { cursor: pointer; color: var(--ok-fg); font-size: .85rem; }
    .pnl { position: fixed; z-index: 1201; inset: 0; margin: auto; width: min(960px, 100%); height: min(100%, 100dvh); background: var(--surface-2); display: flex; flex-direction: column; }
    .pnl header { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; padding: .8rem 1.1rem; background: var(--surface); border-bottom: 1px solid var(--border); } .pnl h3 { margin: 0; font-size: 1.05rem; } .hb { display: flex; gap: .5rem; }
    .pad { padding: .5rem 1.1rem; margin: 0; background: var(--surface); } .acts2 { display: flex; gap: .6rem; flex-wrap: wrap; align-items: center; } .tip { color: var(--ok-fg); } .why { min-width: 14rem; }
    .scroll { flex: 1; overflow: auto; padding: .8rem; } .host { width: max-content; margin: 0 auto; } .host > .pg { margin-bottom: 14px; }
    .wait { display: flex; align-items: center; justify-content: center; gap: .7rem; padding: .8rem; margin: 0 auto .6rem; max-width: 794px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; color: var(--text); }
    .paper { padding: .4rem; border: 1px solid var(--border-strong); border-radius: 8px; font: inherit; } .rs { flex-direction: row; align-items: center; gap: .4rem; } .rs input { width: 9rem; padding: 0; }
    .hist { background: var(--surface); border-radius: 10px; padding: .7rem 1rem; margin: .4rem auto 1rem; max-width: 794px; } .hist h4 { margin: 0 0 .4rem; } .ev { font-size: .85rem; padding: .15rem 0; } .when { color: var(--muted); margin-right: .4rem; }
    :host ::ng-deep .host .pg { cursor: crosshair; box-shadow: 0 2px 10px rgba(0,0,0,.2); }
  `],
})
export class LeaveComponent implements OnInit {
  private api = inject(LeaveService);
  private creditsApi = inject(ServiceCreditsService);
  private auth = inject(AuthService);
  @ViewChild('host') host?: ElementRef<HTMLElement>;
  @ViewChild('scroll') scroll?: ElementRef<HTMLElement>;

  @Input() hideBar = false;
  @Input() pendingOnly = false; // only the applications waiting for my signature
  @Output() changed = new EventEmitter<void>();
  @Input() person: { id: string; name: string; position?: string; station?: string } | null = null;
  me = this.auth.currentUser();
  list: LeaveView[] = []; types: string[] = []; loaded = false;
  dlg: 'form' | 'view' | null = null;
  cur: LeaveView | null = null; editId = ''; personId = '';
  f: LeaveData = blank(); kind = ''; kinds: { kind: string; label: string }[] = [];
  busy = false; error = ''; msg = '';
  placed = false; private pos: { x: number; y: number } | null = null;
  decision: 'approval' | 'disapproval' = 'approval'; reason = '';
  sizePct = 100; sizeMin = 40; sizeMax = Math.round(SIG_MAX / SIG_FRAC * 100); papers = PAPERS; paperId = loadPaper().id;
  private ghostEl: HTMLImageElement | null = null;

  firstName() { return (this.person?.name ?? '').split(' ')[0]; }
  roleName(r: string) { return (ROLE_LABELS as Record<string, string>)[r] ?? r; }
  statusOf(a: LeaveView) { return LEAVE_STATUS[a.status]; }
  turnText(a: LeaveView) { return a.myTurn === 'signatory' ? 'Needs your signature' : 'Please sign'; }
  setPaper(id: string) { this.paperId = id; savePaper(id); }

  async ngOnInit() {
    try { this.types = await firstValueFrom(this.api.types()); } catch { this.types = []; }
    await this.reload();
  }

  async reload() {
    try { const all = await firstValueFrom(this.api.list()); this.list = this.pendingOnly ? all.filter((x) => x.myTurn) : this.person ? all.filter((x) => x.applicant.id === this.person!.id) : all; this.error = ''; } catch (e: any) { this.error = e?.error?.message ?? 'Could not load your leave applications.'; }
    this.loaded = true;
  }

  // ---------- form ----------
  // Office/Department: the school followed by its district (e.g. "Gapas ES STA. FE District")
  private office() {
    const u: any = this.me, sch = u?.school ?? u?.assignedSchools?.[0];
    const name = sch?.name ?? '';
    const d = (sch?.district ?? '').trim();
    return name ? name + (d ? ' ' + (/district\s*$/i.test(d) ? d : d + ' District') : '') : '';
  }

  private fillFor(name: { last: string; first: string; middle: string }, school: string, position: string) {
    this.f = { ...blank(), lastName: name.last, firstName: name.first, middleName: name.middle, office: school, position };
  }

  async startNew() {
    this.error = '';
    this.error = ''; this.editId = '';
    const u = this.me;
    if (this.person) {
      this.personId = this.person.id;
      const parts = this.person.name.split(' ');
      this.fillFor({ last: parts.length > 1 ? parts[parts.length - 1] : this.person.name, first: parts.slice(0, -1).join(' '), middle: '' }, this.office(), this.person.position ?? '');
    } else {
      this.personId = u?.id ?? '';
      this.fillFor({ last: u?.lastName ?? '', first: u?.firstName ?? '', middle: u?.middleName ?? '' }, this.office(), (u as any)?.designation ?? '');
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
      await this.reload(); this.changed.emit();
      this.dlg = null;
      await this.show(v);
    } catch (e: any) { this.error = e?.error?.message ?? 'Could not save.'; }
    this.busy = false;
  }

  startEdit() {
    if (!this.cur) return;
    this.editId = this.cur.id; this.f = { ...this.cur.data }; this.kind = this.cur.kind ?? ''; this.kinds = this.cur.kinds; this.error = ''; this.dlg = 'form';
  }

  async removeCard(a: LeaveView) {
    if (!confirm(a.deducted ? 'Delete this application? The days deducted will be given back.' : 'Delete this application? It will also disappear for the signatory.')) return;
    this.busy = true; this.error = '';
    try { await firstValueFrom(this.api.remove(a.id)); if (this.cur?.id === a.id) this.close(); await this.reload(); this.changed.emit(); } catch (e: any) { this.error = e?.error?.message ?? 'Could not delete.'; }
    this.busy = false;
  }

  // ---------- viewer ----------
  openingId = '';
  async open(id: string) { this.error = ''; this.openingId = id; try { await this.show(await firstValueFrom(this.api.get(id))); } catch (e: any) { this.error = e?.error?.message ?? 'Could not open it.'; } this.openingId = ''; }

  private async show(v: LeaveView) {
    this.cur = v; this.dlg = 'view'; this.msg = ''; this.error = ''; this.pos = null; this.placed = false; this.reason = ''; this.decision = 'approval'; this.sizePct = 100; this.ghostEl = null;
    await this.paint();
  }

  painting = false;
  private async paint() {
    this.painting = true;
    try { await this.paintInner(); } finally { this.painting = false; }
  }

  private async paintInner() {
    const v = this.cur!;
    await new Promise((r) => setTimeout(r));
    const host = this.host?.nativeElement; if (!host) return;
    const page = await buildForm6(v);
    const back = await buildForm6Back();
    host.innerHTML = ''; host.appendChild(page); host.appendChild(back);
    if (v.signAs && v.myTurn) {
      let ghost: HTMLImageElement | null = null;
      page.addEventListener('click', async (e) => {
        const r = page.getBoundingClientRect();
        this.pos = { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
        ghost?.remove();
        ghost = document.createElement('img'); ghost.className = 'tasig ghost'; ghost.src = await blackenPng(v.signAs!);
        ghost.style.cssText = `position:absolute;transform:translate(-50%,-50%);pointer-events:none;opacity:.75;outline:1px dashed #16a34a;left:${this.pos.x * 100}%;top:${this.pos.y * 100}%;width:${SIG_FRAC * PAGE_W * this.sizePct / 100}px;`;
        page.appendChild(ghost); this.ghostEl = ghost; this.placed = true;
      });
    }
    const avail = (this.scroll?.nativeElement.clientWidth ?? 800) - 16;
    host.style.zoom = String(avail < PAGE_W && avail > 200 ? avail / PAGE_W : 1);
  }

  private async apply(p: Promise<LeaveView>, ok: string) {
    this.busy = true; this.error = '';
    try { this.cur = await p; this.msg = ok; this.pos = null; this.placed = false; await this.reload(); this.changed.emit(); await this.paint(); }
    catch (e: any) { this.error = e?.error?.message ?? e?.message ?? 'Something went wrong.'; }
    this.busy = false;
  }

  doSign() {
    const v = this.cur; if (!v || !this.pos) return;
    const body: any = { x: this.pos.x, y: this.pos.y, w: Math.round(SIG_FRAC * this.sizePct) / 100 };
    if (v.myTurn === 'signatory') { body.decision = this.decision; body.reason = this.reason; }
    void this.apply(firstValueFrom(this.api.sign(v.id, body)), v.myTurn === 'applicant' ? `Signed and sent to the ${v.printed.signatoryTitle}.` : this.decision === 'approval' ? 'Approved. The credit has been deducted.' : 'Disapproved.');
  }

  // the signer makes the tapped signature bigger or smaller to fit the signing space
  resize(pct: number) {
    this.sizePct = Math.min(this.sizeMax, Math.max(this.sizeMin, Number(pct)));
    if (this.ghostEl) this.ghostEl.style.width = `${SIG_FRAC * PAGE_W * this.sizePct / 100}px`;
  }

  private pages() { return Array.from(this.host?.nativeElement.querySelectorAll('.pg') ?? []) as HTMLElement[]; }

  // Download straight from the list: the form is laid out off-screen, so the form need not be opened.
  busyId = '';
  async downloadCard(a: LeaveView) {
    this.busy = true; this.busyId = a.id; this.error = '';
    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-10000px;top:0;';
    document.body.appendChild(holder);
    try {
      const v = await firstValueFrom(this.api.get(a.id));
      holder.appendChild(await buildForm6(v)); holder.appendChild(await buildForm6Back());
      DriveUploadService.saveBlob(await form6Pdf(Array.from(holder.querySelectorAll('.pg')) as HTMLElement[], paperOf(this.paperId)), `Form 6 - ${a.applicant.name}.pdf`);
    } catch (e: any) { this.error = e?.error?.message ?? e?.message ?? 'Could not build the file.'; }
    holder.remove();
    this.busy = false;
  }

  async print() {
    const pages = this.pages();
    if (!pages.length) return;
    this.busy = true; this.error = '';
    try { printPdf(await form6Pdf(pages, paperOf(this.paperId))); } catch (e: any) { this.error = e?.message ?? 'Could not prepare the print.'; }
    this.busy = false;
  }

  close() { this.dlg = null; this.cur = null; void this.reload(); }
}
