import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MyFilesService } from '../../core/services/my-files.service';
import { MyFile } from '../../core/models/my-files.model';
import { FilePreviewService } from '../../shared/file-preview/file-preview.service';
import { AuthService } from '../../core/services/auth.service';
import { downloadDriveFile } from '../../shared/pds/pds-download';
import { PdsEditorService } from '../../shared/pds/pds-editor.service';
import { SrEditorService } from '../../shared/service-record/sr-editor.service';
import { SalnEditorService } from '../../shared/saln/saln-editor.service';
import { PdsPreviewService } from '../../shared/pds/pds-preview.service';
import { DriveUploadService, MAX_UPLOAD_BYTES } from '../../core/services/drive-upload.service';

export const WORKING_TYPES = ['PDS', 'Service Record', 'Service Credit', 'SALN', 'Other'];

// Working Directory Files: the person's own working documents (PDS, Service
// Record...) kept in their Drive under TaskEd Files / Working Directory / <type>.
// One current copy per document, so there is no school year here.
@Component({
  selector: 'app-working-files',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    <div class="card tip">
      <strong>Where these go</strong>
      <span><em>TaskEd Files</em> › <em>Working Directory</em> › <em>PDS</em>, <em>Service Record</em>… in your own Google Drive. Only you can see them.</span>
    </div>
    @if (error) { <p class="error">{{ error }}</p> }
    @if (saving) { <div class="bar"><div class="fill" [style.width.%]="progress"></div></div> }
    @if (msg) { <p class="muted">{{ msg }}</p> }
    @for (t of types; track t) {
      <section class="card">
        <div class="sechead">
          <h3>{{ t }}</h3>
          @if (t === 'PDS') {
            <label class="btn pick" [class.disabled]="saving">Upload PDS<input type="file" accept=".xlsx" hidden (change)="openLocalPds($event)" /></label>
          } @else if (t === 'Service Record') {
            <label class="btn pick" [class.disabled]="saving">Upload Service Record<input type="file" accept=".xlsx" hidden (change)="openLocalSr($event)" /></label>
          } @else if (t === 'SALN') {
            <label class="btn pick" [class.disabled]="saving">Upload SALN<input type="file" accept=".docx" hidden (change)="openLocalSaln($event)" /></label>
          } @else {
            <label class="btn pick" [class.disabled]="saving">Upload {{ t }}<input type="file" hidden (change)="uploadDirect($event, t)" /></label>
          }
        </div>
        @if (t === 'PDS') { <p class="muted">Upload your filled PDS (CS Form 212, Revised 2026 .xlsx). TaskEd reads it into simple sections you can edit, then saves it back into the official form.</p> }
        @if (t === 'Service Record') { <p class="muted">Upload your filled Service Record (.xlsx). TaskEd reads it into simple sections you can edit, then saves it back into the official form. The date above "Certified correct" is the day you download or save.</p> }
        @if (t === 'SALN') { <p class="muted">Upload your filled SALN (the 2025 SALN Form, .docx). TaskEd reads it into simple sections you can edit, computes the totals, and saves it back into the official form. The date beside your signature is the day you download or save. The "subscribed and sworn" part is left for the administering officer.</p> }
        @for (f of filesOf(t); track f.id) {
          <div class="frow">
            <div class="info"><strong>{{ f.label }}</strong><small>Added {{ f.createdAt | date: 'MMM d, y' }}</small></div>
            <div class="acts">
              @if (t === 'PDS') {
                <button class="btn secondary" type="button" (click)="editPds(f, true)">Preview</button>
                <button class="btn" type="button" (click)="editPds(f)">Edit</button>
              }
              @else if (t === 'Service Record') {
                <button class="btn secondary" type="button" (click)="editSr(f, true)">Preview</button>
                <button class="btn" type="button" (click)="editSr(f)">Edit</button>
              }
              @else if (t === 'SALN') {
                <button class="btn secondary" type="button" (click)="editSaln(f, true)">Preview</button>
                <button class="btn" type="button" (click)="editSaln(f)">Edit</button>
              }
              @else { <button class="btn secondary" type="button" (click)="preview.open(f.link, f.label)">Preview</button> }
              <button class="btn secondary" type="button" (click)="download(f, t)" [disabled]="saving">Download</button>
              <button class="btn danger" type="button" (click)="remove(f)">Remove</button>
            </div>
          </div>
        } @empty { <p class="muted">No files yet.</p> }
      </section>
    }
  `,
  styleUrl: './my-files.component.scss',
})
export class WorkingFilesComponent implements OnInit {
  private api = inject(MyFilesService);
  private drive = inject(DriveUploadService);
  private auth = inject(AuthService);
  preview = inject(FilePreviewService);
  pds = inject(PdsEditorService);
  private previewSvc = inject(PdsPreviewService);
  saln = inject(SalnEditorService);
  sr = inject(SrEditorService);

  types = WORKING_TYPES;
  files: MyFile[] = [];
  currentYear = '';
  saving = false;
  progress = 0;
  msg = '';
  error = '';

  ngOnInit() { this.load(); }

  load() {
    this.api.list().subscribe({
      next: (v) => { this.currentYear = v.currentYear; this.files = v.files.filter((f) => f.section === 'working'); },
      error: (e) => (this.error = e?.error?.message ?? 'Could not load your files.'),
    });
  }
  filesOf(t: string) { return this.files.filter((f) => (f.category || 'Other') === t); }

  async uploadDirect(ev: Event, type: string) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.saving) return;
    this.error = '';
    if (file.size > MAX_UPLOAD_BYTES) { this.error = 'That file is bigger than 25 MB.'; return; }
    this.saving = true; this.progress = 0; this.msg = 'Asking Google for permission…';
    try {
      const token = await this.drive.accessToken(this.auth.currentUser()?.depedEmail);
      const parent = await this.drive.ensurePath(token, ['Working Directory', type]);
      this.msg = 'Uploading…';
      const up = await this.drive.upload(token, parent, file, (p) => (this.progress = p));
      await firstValueFrom(this.api.add(file.name.replace(/\.[^.]+$/, ''), type, up.link, this.currentYear, 'working'));
      this.msg = 'Uploaded to your Google Drive.';
      this.load();
    } catch (e: any) {
      this.msg = '';
      this.error = e?.error?.message ?? e?.message ?? 'Could not upload.';
    }
    this.saving = false;
  }

  async download(f: MyFile, type: string) {
    this.error = '';
    this.saving = true; this.msg = 'Preparing the download…';
    try {
      const token = await this.drive.accessToken(this.auth.currentUser()?.depedEmail);
      await downloadDriveFile(this.drive, token, f.link, f.label, type === 'PDS' ? 'pds' : type === 'SALN' ? 'saln' : type === 'Service Record' ? 'sr' : false);
      this.msg = '';
    } catch (e: any) {
      this.msg = '';
      this.error = e?.message ?? 'Could not download.';
    }
    this.saving = false;
  }

  editPds(f: MyFile, readOnly = false) {
    const id = DriveUploadService.fileId(f.link);
    if (!id) { this.error = 'This entry has no Google Drive file to open.'; return; }
    const email = this.auth.currentUser()?.depedEmail;
    if (readOnly) {
      this.previewSvc.open({
        title: f.label,
        load: async () => this.drive.download(await this.drive.accessToken(email), id),
        download: () => this.download(f, 'PDS'),
      });
      return;
    }
    this.pds.open({
      title: f.label,
      readOnly,
      fileName: `${f.label}.xlsx`,
      load: async () => this.drive.download(await this.drive.accessToken(email), id),
      save: { label: 'Save to my Drive', run: async (blob) => { await this.drive.replaceContent(await this.drive.accessToken(email), id, blob); return 'Saved to your Google Drive.'; } },
    });
  }

  editSr(f: MyFile, readOnly = false) {
    const id = DriveUploadService.fileId(f.link);
    if (!id) { this.error = 'This entry has no Google Drive file to open.'; return; }
    const email = this.auth.currentUser()?.depedEmail;
    const load = async () => this.drive.download(await this.drive.accessToken(email), id);
    if (readOnly) {
      this.previewSvc.open({ title: f.label, load, download: () => this.download(f, 'Service Record') });
      return;
    }
    this.sr.open({
      title: f.label,
      fileName: `${f.label}.xlsx`,
      load,
      save: { label: 'Save to my Drive', run: async (blob) => { await this.drive.replaceContent(await this.drive.accessToken(email), id, blob); return 'Saved to your Google Drive.'; } },
    });
  }

  openLocalSr(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const email = this.auth.currentUser()?.depedEmail;
    const base = file.name.replace(/\.xlsx$/i, '');
    this.sr.open({
      title: file.name,
      fileName: file.name,
      load: () => file.arrayBuffer(),
      save: {
        label: 'Save a copy to my Drive',
        run: async (blob, name) => {
          const token = await this.drive.accessToken(email);
          const parent = await this.drive.ensurePath(token, ['Working Directory', 'Service Record']);
          const up = await this.drive.upload(token, parent, new File([blob], name, { type: blob.type }), () => {});
          await firstValueFrom(this.api.add(base, 'Service Record', up.link, this.currentYear, 'working'));
          this.load();
          return 'Saved to your Google Drive (Working Directory › Service Record).';
        },
      },
    });
  }

  editSaln(f: MyFile, readOnly = false) {
    const id = DriveUploadService.fileId(f.link);
    if (!id) { this.error = 'This entry has no Google Drive file to open.'; return; }
    const email = this.auth.currentUser()?.depedEmail;
    const load = async () => this.drive.download(await this.drive.accessToken(email), id);
    if (readOnly) {
      this.previewSvc.open({ title: f.label, kind: 'saln', load, download: () => this.download(f, 'SALN') });
      return;
    }
    this.saln.open({
      title: f.label,
      fileName: `${f.label}.docx`,
      load,
      save: { label: 'Save to my Drive', run: async (blob) => { await this.drive.replaceContent(await this.drive.accessToken(email), id, blob); return 'Saved to your Google Drive.'; } },
    });
  }

  openLocalSaln(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const email = this.auth.currentUser()?.depedEmail;
    const base = file.name.replace(/\.docx$/i, '');
    this.saln.open({
      title: file.name,
      fileName: file.name,
      load: () => file.arrayBuffer(),
      save: {
        label: 'Save a copy to my Drive',
        run: async (blob, name) => {
          const token = await this.drive.accessToken(email);
          const parent = await this.drive.ensurePath(token, ['Working Directory', 'SALN']);
          const up = await this.drive.upload(token, parent, new File([blob], name, { type: blob.type }), () => {});
          await firstValueFrom(this.api.add(base, 'SALN', up.link, this.currentYear, 'working'));
          this.load();
          return 'Saved to your Google Drive (Working Directory › SALN).';
        },
      },
    });
  }

  openLocalPds(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const email = this.auth.currentUser()?.depedEmail;
    const base = file.name.replace(/\.xlsx$/i, '');
    this.pds.open({
      title: file.name,
      fileName: file.name,
      load: () => file.arrayBuffer(),
      save: {
        label: 'Save a copy to my Drive',
        run: async (blob, name) => {
          const token = await this.drive.accessToken(email);
          const parent = await this.drive.ensurePath(token, ['Working Directory', 'PDS']);
          const up = await this.drive.upload(token, parent, new File([blob], name, { type: blob.type }), () => {});
          await firstValueFrom(this.api.add(base, 'PDS', up.link, this.currentYear, 'working'));
          this.load();
          return 'Saved to your Google Drive (Working Directory › PDS).';
        },
      },
    });
  }

  async remove(f: MyFile) {
    if (!confirm(`Remove "${f.label}"? It is also moved to the Trash in your Google Drive (you can restore it there for 30 days).`)) return;
    this.error = '';
    try {
      const id = DriveUploadService.fileId(f.link);
      if (id) await this.drive.trash(await this.drive.accessToken(this.auth.currentUser()?.depedEmail), id);
    } catch (e: any) {
      if (!confirm(`Could not delete it from your Drive (${e?.message ?? 'error'}). Remove it from this list anyway?`)) return;
    }
    this.api.remove(f.id).subscribe({ next: () => this.load(), error: (e) => (this.error = e?.error?.message ?? 'Could not remove.') });
  }
}
