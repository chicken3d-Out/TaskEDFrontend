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
          } @else {
            <label class="btn pick" [class.disabled]="saving">Upload {{ t }}<input type="file" hidden (change)="uploadDirect($event, t)" /></label>
          }
        </div>
        @if (t === 'PDS') { <p class="muted">Upload your filled PDS (CS Form 212, Revised 2026 .xlsx). TaskEd reads it into simple sections you can edit, then saves it back into the official form.</p> }
        @for (f of filesOf(t); track f.id) {
          <div class="frow">
            <div class="info"><strong>{{ f.label }}</strong><small>Added {{ f.createdAt | date: 'MMM d, y' }}</small></div>
            <div class="acts">
              @if (t === 'PDS') { <button class="btn" type="button" (click)="editPds(f)">Edit</button> }
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
      await downloadDriveFile(this.drive, token, f.link, f.label, type === 'PDS');
      this.msg = '';
    } catch (e: any) {
      this.msg = '';
      this.error = e?.message ?? 'Could not download.';
    }
    this.saving = false;
  }

  editPds(f: MyFile) {
    const id = DriveUploadService.fileId(f.link);
    if (!id) { this.error = 'This entry has no Google Drive file to open.'; return; }
    const email = this.auth.currentUser()?.depedEmail;
    this.pds.open({
      title: f.label,
      fileName: `${f.label}.xlsx`,
      load: async () => this.drive.download(await this.drive.accessToken(email), id),
      save: { label: 'Save to my Drive', run: async (blob) => { await this.drive.replaceContent(await this.drive.accessToken(email), id, blob); return 'Saved to your Google Drive.'; } },
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

  remove(f: MyFile) {
    if (!confirm(`Remove "${f.label}"? The file itself stays in your Drive.`)) return;
    this.api.remove(f.id).subscribe({ next: () => this.load(), error: (e) => (this.error = e?.error?.message ?? 'Could not remove.') });
  }
}
