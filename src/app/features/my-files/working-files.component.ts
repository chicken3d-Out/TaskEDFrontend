import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MyFilesService } from '../../core/services/my-files.service';
import { MyFile } from '../../core/models/my-files.model';
import { FilePreviewService } from '../../shared/file-preview/file-preview.service';
import { AuthService } from '../../core/services/auth.service';
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
    <form class="card up" (ngSubmit)="upload()">
      <h2>Upload a working file</h2>
      <div class="grid">
        <label>Type
          <select name="type" [(ngModel)]="type">@for (t of types; track t) { <option>{{ t }}</option> }</select>
        </label>
        <label>Label *<input name="label" [(ngModel)]="label" placeholder="e.g. PDS 2026" maxlength="150" /></label>
        <label class="wide">File * (PDF, Word, Excel… up to 25 MB)<input #fi type="file" name="file" (change)="onFile($event)" /></label>
      </div>
      @if (error) { <p class="error">{{ error }}</p> }
      @if (saving) { <div class="bar"><div class="fill" [style.width.%]="progress"></div></div> }
      @if (msg) { <p class="muted">{{ msg }}</p> }
      <div class="row"><button class="btn" type="submit" [disabled]="saving || !file || !label.trim()">{{ saving ? 'Uploading…' : 'Upload to my Drive' }}</button></div>
    </form>
    <div class="card tip">
      <strong>Edit your PDS in TaskEd</strong>
      <span>Open your filled-in PDS (CS Form 212, Revised 2026 .xlsx). TaskEd shows it as simple sections, you edit, and it is saved back into the official form.</span>
      <label class="btn secondary pick">Open a PDS from this computer<input type="file" accept=".xlsx" hidden (change)="openLocalPds($event)" /></label>
    </div>
    @for (t of types; track t) {
      <section class="card">
        <h3>{{ t }}</h3>
        @for (f of filesOf(t); track f.id) {
          <div class="frow">
            <div class="info"><strong>{{ f.label }}</strong><small>Added {{ f.createdAt | date: 'MMM d, y' }}</small></div>
            <div class="acts">
              @if (t === 'PDS') { <button class="btn" type="button" (click)="editPds(f)">Edit</button> }
              <button class="btn secondary" type="button" (click)="preview.open(f.link, f.label)">Preview</button>
              <a class="btn secondary" [href]="f.link" target="_blank" rel="noopener noreferrer">Open</a>
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
  @ViewChild('fi') fi?: ElementRef<HTMLInputElement>;

  types = WORKING_TYPES;
  type = 'PDS';
  label = '';
  file: File | null = null;
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

  onFile(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0] ?? null;
    this.error = '';
    if (f && f.size > MAX_UPLOAD_BYTES) { this.error = 'That file is bigger than 25 MB.'; this.file = null; return; }
    this.file = f;
    if (f && !this.label.trim()) this.label = f.name.replace(/\.[^.]+$/, '');
  }

  async upload() {
    if (!this.file || !this.label.trim() || this.saving) return;
    this.saving = true; this.error = ''; this.progress = 0; this.msg = 'Asking Google for permission…';
    try {
      const token = await this.drive.accessToken(this.auth.currentUser()?.depedEmail);
      this.msg = 'Preparing folders…';
      const parent = await this.drive.ensurePath(token, ['Working Directory', this.type]);
      this.msg = 'Uploading…';
      const up = await this.drive.upload(token, parent, this.file, (p) => (this.progress = p));
      await firstValueFrom(this.api.add(this.label.trim(), this.type, up.link, this.currentYear, 'working'));
      this.msg = 'Uploaded to your Google Drive.';
      this.label = ''; this.file = null;
      if (this.fi) this.fi.nativeElement.value = '';
      this.load();
    } catch (e: any) {
      this.msg = '';
      this.error = e?.error?.message ?? e?.message ?? 'Could not upload.';
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
