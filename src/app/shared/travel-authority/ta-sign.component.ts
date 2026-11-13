import { Component, ElementRef, ViewChild, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { TaAttPreviewService } from './ta-att-preview.component';
import { DriveUploadService } from '../../core/services/drive-upload.service';
import { STATUS_LABEL, TaAttachment, TaRecord, TravelAuthorityService } from '../../core/services/travel-authority.service';
import { blackenPng } from '../signature/blacken';
import { buildPdf, renderBasePage } from './ta-pdf';
import { TaSignService } from './ta-sign.service';
import { fileLabel, hasDriveToken, openTemplate, syncToDrive } from './ta-doc';
import { TaPackage, pageSizeIn, pngSizeOf, sigSizeIn } from './ta-engine';

function b64(buf: ArrayBuffer): string { const a = new Uint8Array(buf); let s = ''; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000)); return btoa(s); }

const ROLE_WORD = { requester: 'the employee', countersign: 'the School Head (countersigning)', recommending: 'the recommending authority', approving: 'the approving authority' };

@Component({
  selector: 'app-ta-sign',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (svc.current()) {
      <div class="backdrop" (click)="close()"></div>
      <div class="panel" role="dialog" aria-modal="true" aria-label="Travel Authority">
        <header>
          <div>
            <h2>{{ rec ? (svc.current()?.draft ? 'Preview' : 'Travel Authority') : 'Opening…' }}</h2>
            @if (rec) { <small>{{ rec.data.name }}{{ svc.current()?.draft ? ' · as typed so far, not saved yet' : ' · ' + status(rec) }}</small> }
          </div>
          <div class="hbtns">
            @if (rec) { <button class="btn secondary" type="button" (click)="download()" [disabled]="busy || loading">Download PDF</button> }
            @if (rec?.myTurn && placed()) { <button class="btn" type="button" (click)="doSign()" [disabled]="busy">{{ busy ? 'Saving…' : 'Save signature' }}</button> }
            <button class="btn secondary" type="button" (click)="close()">Close</button>
          </div>
        </header>
        @if (error) { <p class="error pad">{{ error }}</p> }
        @if (msg) { <p class="ok pad">{{ msg }}</p> }
        @if (rec?.myTurn && !mySig) { <p class="error pad">{{ rec?.myTurn === 'recommending' || rec?.myTurn === 'approving' ? 'There is no signature to place yet. Add yours in My profile (or, for the District Supervisor’s step, ask the Administrator to upload the District Supervisor’s signature), then come back.' : 'You have no signature yet. Add one in My profile, then come back.' }}</p> }
        @if (rec?.myTurn && mySig) {
          <p class="tip pad">Signing as {{ roleWord() }}. <strong>Tap the form where your signature should go</strong>{{ placed() ? ' (tap again to move it)' : '' }}, then press “Save signature”. It goes to the next signatory.</p>
        }
        @if (rec?.attachments?.length) {
          <div class="pad att"><strong>Attachments:</strong>
            @for (a of rec!.attachments!; track a.id) { <a href="javascript:void(0)" (click)="openAtt(a)">{{ a.name }}</a> }
          </div>
        }
        @if (rec?.myTurn === 'recommending' && rec?.approvingByEmail) { <p class="pad muted">After you sign, {{ rec!.ownerName }} (who applied) emails the signed form and its attachments to the Travel Authority mailbox for the remaining authority.</p> }
        <div class="scroll" #scroll>
          @if (loading) { <p class="muted pad">Laying out the form…</p> }
          <div class="host" #host></div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: contents; }
    .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 1200; }
    .panel { position: fixed; z-index: 1201; inset: 0; margin: auto; width: min(960px, 100%); height: min(100%, 100dvh); background: #f3f4f6; display: flex; flex-direction: column; }
    header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; padding: .8rem 1.1rem; background: #fff; border-bottom: 1px solid #e5e7eb; flex-wrap: wrap; }
    header h2 { margin: 0; font-size: 1.1rem; } header small { color: #6b7280; }
    .hbtns { display: flex; gap: .5rem; flex-wrap: wrap; }
    .pad { padding: .5rem 1.1rem; margin: 0; background: #fff; }
    .tip { background: #f0fdf4; color: #166534; }
    .scroll { flex: 1; overflow: auto; padding: .8rem; }
    .host { width: max-content; margin: 0 auto; }
    .att { display: flex; gap: .8rem; flex-wrap: wrap; font-size: .88rem; } .att a { color: #15803d; }
    .muted { color: #6b7280; } .ok { color: #166534; } .error { color: #b91c1c; }
    :host ::ng-deep .host .pg { position: relative; cursor: crosshair; background: #fff; box-shadow: 0 2px 10px rgba(0,0,0,.2); margin-bottom: 12px; }
    :host ::ng-deep .host img.tasig { position: absolute; pointer-events: none; transform: translate(-50%, -50%); }
    :host ::ng-deep .host img.tasig.ghost { opacity: .75; outline: 1px dashed #16a34a; }
  `],
})
export class TaSignComponent {
  svc = inject(TaSignService);
  private api = inject(TravelAuthorityService);
  private auth = inject(AuthService);
  private drive = inject(DriveUploadService);
  private attPreview = inject(TaAttPreviewService);
  @ViewChild('host') host?: ElementRef<HTMLElement>;
  @ViewChild('scroll') scroll?: ElementRef<HTMLElement>;

  rec: TaRecord | null = null;
  mySig: string | null = null;
  loading = false;
  busy = false;
  error = '';
  msg = '';
  placed = signal(false);
  private pos: { x: number; y: number } | null = null;
  private pkg: TaPackage | null = null;
  private base: HTMLCanvasElement | null = null;

  constructor() {
    effect(() => {
      const r = this.svc.current();
      this.rec = null; this.error = ''; this.msg = ''; this.pos = null; this.placed.set(false); this.mySig = null;
      if (!r) return;
      this.loading = true;
      (r.draft ? this.loadDraft(r.draft) : this.load(r.id)).catch((e) => (this.error = e?.error?.message ?? e?.message ?? 'Could not open it.')).finally(() => (this.loading = false));
    }, { allowSignalWrites: true });
  }

  status(r: TaRecord) { return STATUS_LABEL[r.status]; }
  roleWord() { return this.rec?.myTurn ? ROLE_WORD[this.rec.myTurn] : ''; }

  private async loadDraft(draft: TaRecord) {
    this.rec = draft;
    this.pkg = this.pkg ?? (await openTemplate());
    await this.paint();
  }

  private async load(id: string) {
    const rec = await firstValueFrom(this.api.get(id));
    this.rec = rec;
    if (rec.myTurn) this.mySig = rec.signAs ?? (await firstValueFrom(this.api.getSignature())).signature;
    this.pkg = this.pkg ?? (await openTemplate());
    await this.paint();
  }

  private async paint() {
    const rec = this.rec!;
    await new Promise((r) => setTimeout(r));
    this.loading = true;
    let base: HTMLCanvasElement;
    try { base = await renderBasePage(rec, this.pkg!); } finally { this.loading = false; }
    const host = this.host!.nativeElement;
    host.innerHTML = '';
    const size = pageSizeIn(this.pkg!);
    // the fixed page: a picture of the finished form. Signatures are tapped onto it.
    const page = document.createElement('div');
    page.className = 'pg';
    page.style.width = `${size.w * 96}px`;
    page.style.height = `${size.h * 96}px`;
    const bg = new Image();
    bg.src = base.toDataURL('image/jpeg', 0.92);
    bg.style.cssText = 'width:100%;height:100%;display:block;pointer-events:none';
    page.appendChild(bg);
    host.appendChild(page);
    this.base = base;
    const addImg = async (img: string, x: number, y: number, cls: string) => {
      const px = pngSizeOf(img), s = sigSizeIn(px.w, px.h);
      const el = document.createElement('img');
      el.src = await blackenPng(img); el.className = cls;
      el.style.left = `${x * 100}%`; el.style.top = `${y * 100}%`; el.style.width = `${(s.w / size.w) * 100}%`;
      page.appendChild(el);
      return el;
    };
    for (const s of [rec.sigs?.requester, rec.sigs?.countersign, rec.sigs?.recommending, rec.sigs?.approving]) if (s) await addImg(s.img, s.x, s.y, 'tasig');
    let ghost: HTMLImageElement | null = null;
    if (rec.myTurn && this.mySig) {
      page.addEventListener('click', async (e) => {
        const r = page.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        this.pos = { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
        ghost?.remove();
        ghost = await addImg(this.mySig!, this.pos.x, this.pos.y, 'tasig ghost');
        this.placed.set(true);
      });
    }
    // fit narrow screens
    const avail = (this.scroll?.nativeElement.clientWidth ?? 800) - 16;
    const w = page.getBoundingClientRect().width;
    if (w > avail && avail > 200) host.style.zoom = String(avail / w); else host.style.zoom = '1';
  }

  async doSign() {
    if (!this.rec || !this.pos) return;
    this.busy = true; this.error = '';
    try {
      const rec = await firstValueFrom(this.api.sign(this.rec.id, this.pos.x, this.pos.y));
      this.api.bump();
      const next = rec.status === 'awaiting_countersign' ? rec.countersignName : rec.status === 'awaiting_recommending' ? rec.recommendingName : rec.approvingName;
      this.msg = rec.status === 'awaiting_email' ? `Signed. ${rec.ownerName} will now email it to the Travel Authority mailbox.` : rec.status === 'approved' ? 'Signed. The Travel Authority is now fully signed.' : `Signed. It now goes to ${next}.`;
      this.rec = rec; this.pos = null; this.placed.set(false);
      await this.paint();
      if (rec.isOwner && hasDriveToken()) {
        try { await syncToDrive(this.drive, this.api, this.auth.currentUser()?.depedEmail, rec); this.api.bump(); } catch { /* the log will offer to sync */ }
      }
    } catch (e: any) { this.error = e?.error?.message ?? e?.message ?? 'Could not sign.'; }
    this.busy = false;
  }

  openAtt(a: TaAttachment) { void this.attPreview.open(this.rec!.id, a); }

  async download() {
    if (!this.rec) return;
    this.busy = true; this.error = '';
    try { DriveUploadService.saveBlob(await buildPdf(this.rec, this.pkg!, this.base ?? undefined), `${fileLabel(this.rec)}.pdf`); }
    catch (e: any) { this.error = e?.message ?? 'Could not build the file.'; }
    this.busy = false;
  }

  close() { this.svc.close(); this.api.bump(); }
}
