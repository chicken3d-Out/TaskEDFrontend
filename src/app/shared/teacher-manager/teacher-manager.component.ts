import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { HrProfileService, TeacherFilesView } from '../../core/services/hr-profile.service';
import { DriveUploadService, MAX_UPLOAD_BYTES } from '../../core/services/drive-upload.service';
import { AuthService } from '../../core/services/auth.service';
import { PdsEditorService } from '../pds/pds-editor.service';
import { FilePreviewService } from '../file-preview/file-preview.service';
import { downloadDriveFile } from '../pds/pds-download';
import { HrProfileFormComponent } from '../hr-profile-form/hr-profile-form.component';

// The Administrative Officer's workspace for one teacher: employment details,
// and the AO's own copy of the teacher's documents (saved in the AO's Drive).
@Component({
  selector: 'app-teacher-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, HrProfileFormComponent],
  template: `
    <div class="backdrop" (click)="close.emit()"></div>
    <div class="panel" role="dialog" aria-modal="true">
      <header>
        <div><h2>{{ teacherName }}</h2><small>{{ schoolName }}</small></div>
        <button class="btn secondary" type="button" (click)="close.emit()">Close</button>
      </header>
      <div class="tabs">
        <button type="button" [class.on]="tab === 'profile'" (click)="tab = 'profile'">Employment details</button>
        <button type="button" [class.on]="tab === 'files'" (click)="tab = 'files'">Documents</button>
      </div>

      @if (tab === 'profile') {
        <app-hr-profile-form [userId]="teacherId" />
      } @else {
        <p class="muted">
          Your own copy, saved in <strong>your Google Drive</strong> under <em>TaskEd Files › {{ folderTeachers }} › {{ teacherName }}</em>.
          This is separate from the teacher's own My files.
        </p>
        @if (busy) { <div class="bar"><div class="fill" [style.width.%]="progress"></div></div> }
        @if (msg) { <p class="muted">{{ msg }}</p> }
        @if (error) { <p class="error">{{ error }}</p> }
        @if (view) {
          @for (s of sections; track s) {
            <div class="sechead">
              <h3>{{ s }}</h3>
              @if (s === 'PDS') {
                <label class="btn pick" [class.disabled]="busy">Upload PDS<input type="file" accept=".xlsx" hidden (change)="openLocalPds($event)" /></label>
              } @else {
                <label class="btn pick" [class.disabled]="busy">Upload {{ s }}<input type="file" hidden (change)="uploadDirect($event, s)" /></label>
              }
            </div>
            @for (f of filesOf(s); track f.id) {
              <div class="frow">
                <div><strong>{{ f.label }}</strong><small>Added {{ f.createdAt | date: 'MMM d, y' }}</small></div>
                <div class="acts">
                  @if (s === 'PDS') {
                    <button class="btn secondary" type="button" (click)="editPds(f, true)">Preview</button>
                    <button class="btn" type="button" (click)="editPds(f)">Edit</button>
                  }
                  @else { <button class="btn secondary" type="button" (click)="preview.open(f.link, f.label)">Preview</button> }
                  <button class="btn secondary" type="button" (click)="download(f, s)" [disabled]="busy">Download</button>
                  <button class="btn danger" type="button" (click)="remove(f.id, f.label, f.link)">Remove</button>
                </div>
              </div>
            } @empty { <p class="muted">No files yet.</p> }
          }
        }
      }
    </div>
  `,
  styles: [`
    :host { position: fixed; inset: 0; z-index: 1000; display: block; }
    .backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.45); }
    .panel { position: absolute; top: 0; right: 0; bottom: 0; width: min(760px, 100%); background: #fff; overflow-y: auto; padding: 1.2rem; box-shadow: -8px 0 30px rgba(0,0,0,.2); }
    header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
    header h2 { margin: 0; } header small { color: #6b7280; }
    .tabs { display: flex; gap: .4rem; margin: 1rem 0; }
    .tabs button { border: 1px solid #e5e7eb; background: #fff; border-radius: 999px; padding: .4rem .9rem; font: inherit; cursor: pointer; }
    .tabs button.on { background: #15803d; color: #fff; border-color: #15803d; }
    .sechead { display: flex; justify-content: space-between; align-items: center; gap: .6rem; margin-top: 1rem; }
    .sechead h3 { margin: 0; }
    .pick { cursor: pointer; } .pick.disabled { opacity: .5; pointer-events: none; }
    .up { display: flex; flex-wrap: wrap; gap: .5rem; margin: .6rem 0; }
    .up input[type=text], .up input:not([type]) { flex: 1; min-width: 160px; }
    .up select, .up input { padding: .5rem .6rem; border: 1px solid #d1d5db; border-radius: 8px; font: inherit; }
    .bar { height: 6px; background: #e5e7eb; border-radius: 6px; overflow: hidden; } .fill { height: 100%; background: #15803d; }
    h3 { margin: 1rem 0 .3rem; font-size: .95rem; }
    .frow { display: flex; justify-content: space-between; align-items: center; gap: .6rem; flex-wrap: wrap; padding: .5rem 0; border-bottom: 1px solid #f1f5f9; }
    .frow small { display: block; color: #6b7280; } .acts { display: flex; gap: .4rem; }
    .muted { color: #6b7280; font-size: .85rem; } .error { color: #b91c1c; }
  `],
})
export class TeacherManagerComponent implements OnInit {
  private api = inject(HrProfileService);
  private drive = inject(DriveUploadService);
  private auth = inject(AuthService);
  preview = inject(FilePreviewService);
  pds = inject(PdsEditorService);

  @Input({ required: true }) teacherId!: string;
  @Output() close = new EventEmitter<void>();

  tab: 'profile' | 'files' = 'profile';
  view: TeacherFilesView | null = null;
  sections = ['PDS', 'Service Record', 'Service Credit', 'SALN', 'Other'];
  section = 'PDS';
  label = '';
  file: File | null = null;
  busy = false;
  progress = 0;
  msg = '';
  error = '';

  get teacherName() { return this.view?.teacherName ?? ''; }
  get schoolName() { return this.view?.schoolName ?? ''; }
  get folderTeachers() { return `Teachers ${this.schoolName}`.trim(); }

  ngOnInit() { this.load(); }

  load() {
    this.api.teacherFiles(this.teacherId).subscribe({
      next: (v) => { this.view = v; this.sections = v.sections; },
      error: (e) => (this.error = e?.error?.message ?? 'Could not load documents.'),
    });
  }

  filesOf(s: string) { return (this.view?.files ?? []).filter((f) => f.section === s); }

  private async saveFile(file: File | Blob, name: string, section: string) {
    const token = await this.drive.accessToken(this.auth.currentUser()?.depedEmail);
    this.msg = 'Preparing folders…';
    const parent = await this.drive.ensurePath(token, [this.folderTeachers, this.teacherName || 'Teacher', section]);
    this.msg = 'Uploading…';
    const f = file instanceof File ? file : new File([file], name, { type: file.type });
    const up = await this.drive.upload(token, parent, f, (p) => (this.progress = p));
    await firstValueFrom(this.api.addTeacherFile(this.teacherId, section, name.replace(/\.[^.]+$/, ''), up.link));
    this.load();
  }

  async uploadDirect(ev: Event, section: string) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.busy) return;
    this.error = '';
    if (file.size > MAX_UPLOAD_BYTES) { this.error = 'That file is bigger than 25 MB.'; return; }
    this.busy = true; this.progress = 0; this.msg = 'Asking Google for permission…';
    try {
      await this.saveFile(file, file.name, section);
      this.msg = 'Saved to your Drive.';
    } catch (e: any) {
      this.msg = '';
      this.error = e?.error?.message ?? e?.message ?? 'Could not upload.';
    }
    this.busy = false;
  }

  // The PDS is read straight away so it can be corrected before it is saved.
  openLocalPds(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.pds.open({
      title: `${this.teacherName} – ${file.name}`,
      fileName: file.name,
      load: () => file.arrayBuffer(),
      save: { label: 'Save to my Drive', run: async (blob, name) => { await this.saveFile(blob, name, 'PDS'); return 'Saved to your Drive.'; } },
    });
  }

  async download(f: { link: string; label: string }, section: string) {
    this.error = '';
    try {
      const token = await this.drive.accessToken(this.auth.currentUser()?.depedEmail);
      await downloadDriveFile(this.drive, token, f.link, f.label, section === 'PDS');
    } catch (e: any) {
      this.error = e?.message ?? 'Could not download.';
    }
  }

  editPds(f: { link: string; label: string }, readOnly = false) {
    const id = DriveUploadService.fileId(f.link);
    if (!id) { this.error = 'This entry has no Google Drive file to open.'; return; }
    const email = this.auth.currentUser()?.depedEmail;
    this.pds.open({
      title: `${this.teacherName} – ${f.label}`,
      readOnly,
      fileName: `${f.label}.xlsx`,
      load: async () => this.drive.download(await this.drive.accessToken(email), id),
      save: { label: 'Save to my Drive', run: async (blob) => { await this.drive.replaceContent(await this.drive.accessToken(email), id, blob); return 'Saved to your Google Drive.'; } },
    });
  }

  async remove(id: string, label: string, link: string) {
    if (!confirm(`Remove "${label}"? It is also moved to the Trash in your Google Drive (you can restore it there for 30 days).`)) return;
    this.error = '';
    try {
      const fid = DriveUploadService.fileId(link);
      if (fid) await this.drive.trash(await this.drive.accessToken(this.auth.currentUser()?.depedEmail), fid);
    } catch (e: any) {
      if (!confirm(`Could not delete it from your Drive (${e?.message ?? 'error'}). Remove it from this list anyway?`)) return;
    }
    this.api.removeTeacherFile(id).subscribe({ next: () => this.load(), error: (e) => (this.error = e?.error?.message ?? 'Could not remove.') });
  }
}
