import { Component, Input, OnInit, effect, inject, untracked } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { DriveUploadService } from '../../core/services/drive-upload.service';
import { STATUS_LABEL, TaRecord, TravelAuthorityService } from '../../core/services/travel-authority.service';
import { TaEditorService } from '../../shared/travel-authority/ta-editor.service';
import { TaSignService } from '../../shared/travel-authority/ta-sign.service';
import { sendToTravelMailbox } from '../../shared/travel-authority/ta-send';
import { fileLabel, hasDriveToken, monthKey, openTemplate, syncToDrive } from '../../shared/travel-authority/ta-doc';
import { buildPdf } from '../../shared/travel-authority/ta-pdf';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Apply for a Travel Authority, sign the ones waiting for you, and see the log (by month).
// With `teacher` set (AO / AO Publisher in Manage teacher) it applies for and lists that teacher's.
@Component({
  selector: 'app-ta-log',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <div class="top">
      <button class="btn" type="button" (click)="apply()">{{ teacher ? 'Apply Travel Authority for ' + firstName() : 'Apply Travel Authority' }}</button>
    </div>
    @if (error) { <p class="error">{{ error }}</p> }
    @if (msg) { <p class="muted">{{ msg }}</p> }

    @if (!teacher && inbox.length) {
      <section class="card todo">
        <h3>For my action ({{ inbox.length }})</h3>
        @for (r of inbox; track r.id) {
          <div class="frow">
            <div class="info">
              <strong>{{ r.data.name }}</strong>
              <small>{{ summary(r) }}</small>
              <small class="st">{{ status(r) }}</small>
            </div>
            <div class="acts">
              @if (r.status === 'awaiting_email') { <button class="btn" type="button" (click)="sendMail(r)" [disabled]="busy">Send to Travel Authority</button> }
              @else { <button class="btn" type="button" (click)="open(r)">Review &amp; sign</button> }
            </div>
          </div>
        }
      </section>
    }

    <h3 class="logh">Travel Authority log</h3>
    @for (g of groups; track g.key) {
      <section class="card year">
        <button type="button" class="head" (click)="toggle(g.key)" [attr.aria-expanded]="isOpen(g.key)">
          <span class="chev">{{ isOpen(g.key) ? '▾' : '▸' }}</span>
          <strong>{{ g.label }}</strong>
          <span class="muted">{{ g.rows.length }} Travel Authorit{{ g.rows.length === 1 ? 'y' : 'ies' }}</span>
        </button>
        @if (isOpen(g.key)) {
          @for (r of g.rows; track r.id) {
            <div class="frow">
              <div class="info">
                <strong>Travel Authority – {{ r.data.name }}</strong>
                <small>{{ summary(r) }}</small>
                <small><span class="chip" [class.ok]="r.status === 'approved'">{{ status(r) }}</span>
                  @if (!r.isOwner) { · prepared by {{ r.ownerName }} }
                  @if (r.isOwner && r.needsDriveSync) { · <a href="javascript:void(0)" (click)="syncOne(r)">Update my Drive copy</a> }</small>
              </div>
              <div class="acts">
                @if (r.isOwner && r.status === 'awaiting_email') { <button class="btn" type="button" (click)="sendMail(r)" [disabled]="busy">Send to Travel Authority</button> }
                <button class="btn secondary" type="button" (click)="open(r)">{{ r.myTurn ? 'Review & sign' : 'Preview' }}</button>
                @if (r.isOwner && (r.status === 'draft' || r.status === 'awaiting_requester')) { <button class="btn" type="button" (click)="edit(r)">Edit</button> }
                @if (r.isOwner && r.status === 'draft' && r.requesterId !== meId) { <button class="btn" type="button" (click)="send(r)">Send to sign</button> }
                <button class="btn secondary" type="button" (click)="download(r)" [disabled]="busy">Download</button>
                @if (r.isOwner) { <button class="btn danger" type="button" (click)="remove(r)">Delete</button> }
              </div>
            </div>
          }
        }
      </section>
    } @empty { <p class="muted">{{ loaded ? 'No travel authorities yet.' : 'Loading…' }}</p> }
  `,
  styleUrl: './my-files.component.scss',
  styles: [`
    .top { margin-bottom: .8rem; } .logh { margin: 1.2rem 0 .5rem; }
    .todo { border-left: 4px solid #16a34a; }
    .head { display: flex; gap: .6rem; align-items: center; width: 100%; background: none; border: 0; padding: .3rem 0; font: inherit; cursor: pointer; text-align: left; }
    .chev { width: 1rem; }
    .chip { background: #fef3c7; color: #92400e; border-radius: 999px; padding: .05rem .55rem; font-size: .75rem; } .chip.ok { background: #dcfce7; color: #166534; }
    .st { color: #92400e; }
    .info { display: flex; flex-direction: column; gap: .1rem; min-width: 0; } .info small { color: #6b7280; }
  `],
})
export class TaLogComponent implements OnInit {
  @Input() teacher: { id: string; name: string; position: string; station: string } | null = null;
  private api = inject(TravelAuthorityService);
  private auth = inject(AuthService);
  private drive = inject(DriveUploadService);
  private editor = inject(TaEditorService);
  private signer = inject(TaSignService);

  all: TaRecord[] = [];
  inbox: TaRecord[] = [];
  loaded = false;
  busy = false;
  error = '';
  msg = '';
  private opened = new Set<string>();
  private closed = new Set<string>();
  private syncing = false;
  meId = '';

  constructor() {
    effect(() => { this.api.version(); untracked(() => this.load()); });
  }
  ngOnInit() { this.meId = this.auth.currentUser()?.id ?? ''; }

  firstName() { return (this.teacher?.name ?? '').split(' ')[0]; }
  status(r: TaRecord) { return STATUS_LABEL[r.status]; }
  summary(r: TaRecord) { return `${r.data.dates || 'No dates yet'} · ${r.requesterName} → ${r.data.destination || 'No destination'}`; }

  private load() {
    this.meId = this.auth.currentUser()?.id ?? '';
    firstValueFrom(this.api.mine()).then((rows) => {
      this.all = this.teacher ? rows.filter((r) => r.requesterId === this.teacher!.id && r.isOwner) : rows;
      this.loaded = true;
      void this.autoSync();
    }).catch((e) => { this.loaded = true; this.error = e?.error?.message ?? 'Could not load your Travel Authorities.'; });
    if (!this.teacher) firstValueFrom(this.api.inbox()).then((r) => (this.inbox = r)).catch(() => {});
  }

  // rebuild the single Drive copy of anything that was signed by someone else meanwhile
  private async autoSync() {
    if (this.syncing || !hasDriveToken()) return;
    const stale = this.all.filter((r) => r.isOwner && r.needsDriveSync);
    if (!stale.length) return;
    this.syncing = true;
    try {
      for (const r of stale) await syncToDrive(this.drive, this.api, this.auth.currentUser()?.depedEmail, r);
      this.syncing = false;
      this.api.bump();
    } catch { this.syncing = false; }
  }

  get groups() {
    const m = new Map<string, TaRecord[]>();
    for (const r of this.all) m.set(monthKey(r), [...(m.get(monthKey(r)) ?? []), r]);
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([key, rows]) => ({
      key,
      label: `${MONTHS[Number(key.slice(5, 7)) - 1] ?? ''} ${key.slice(0, 4)}`,
      rows: rows.sort((a, b) => ((b.data.dateFrom || b.createdAt) + b.createdAt).localeCompare((a.data.dateFrom || a.createdAt) + a.createdAt)),
    }));
  }
  isOpen(k: string) { if (this.opened.has(k)) return true; if (this.closed.has(k)) return false; return k === this.groups[0]?.key; }
  toggle(k: string) { if (this.isOpen(k)) { this.opened.delete(k); this.closed.add(k); } else { this.closed.delete(k); this.opened.add(k); } }

  apply() { this.editor.open(this.teacher ? { forTeacher: this.teacher } : {}); }
  edit(r: TaRecord) { this.editor.open({ record: r }); }
  open(r: TaRecord) { this.signer.open(r.id); }

  async send(r: TaRecord) {
    this.error = '';
    try { await firstValueFrom(this.api.send(r.id)); this.api.bump(); this.msg = 'Sent to the employee to sign.'; }
    catch (e: any) { this.error = e?.error?.message ?? 'Could not send.'; }
  }

  async sendMail(r: TaRecord) {
    this.error = ''; this.msg = ''; this.busy = true;
    try {
      await sendToTravelMailbox(this.drive, this.api, this.auth, r);
      this.msg = 'Emailed to travel.authority@deped.gov.ph from your DepEd email.';
      this.api.bump();
    } catch (e: any) { this.error = e?.error?.message ?? e?.message ?? 'Could not send the email.'; }
    this.busy = false;
  }

  async syncOne(r: TaRecord) {
    this.error = ''; this.msg = 'Updating your Drive copy…';
    try { await syncToDrive(this.drive, this.api, this.auth.currentUser()?.depedEmail, r); this.msg = 'Drive copy updated.'; this.api.bump(); }
    catch (e: any) { this.msg = ''; this.error = e?.message ?? 'Could not update Drive.'; }
  }

  async download(r: TaRecord) {
    this.busy = true; this.error = '';
    try {
      const full = await firstValueFrom(this.api.get(r.id));
      DriveUploadService.saveBlob(await buildPdf(full, await openTemplate()), `${fileLabel(full)}.pdf`);
    } catch (e: any) { this.error = e?.message ?? 'Could not build the file.'; }
    this.busy = false;
  }

  async remove(r: TaRecord) {
    if (!confirm('Delete this Travel Authority? Its Word file is also moved to the Trash in your Google Drive (you can restore it there for 30 days).')) return;
    try {
      const id = r.driveLink ? DriveUploadService.fileId(r.driveLink) : null;
      if (id) await this.drive.trash(await this.drive.accessToken(this.auth.currentUser()?.depedEmail), id);
    } catch (e: any) {
      if (!confirm(`Could not delete it from your Drive (${e?.message ?? 'error'}). Delete it from the log anyway?`)) return;
    }
    try { await firstValueFrom(this.api.remove(r.id)); this.api.bump(); } catch (e: any) { this.error = e?.error?.message ?? 'Could not delete.'; }
  }
}
