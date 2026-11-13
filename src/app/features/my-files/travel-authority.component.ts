import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MyFilesService } from '../../core/services/my-files.service';
import { MyFile } from '../../core/models/my-files.model';
import { AuthService } from '../../core/services/auth.service';
import { DriveUploadService, MAX_UPLOAD_BYTES } from '../../core/services/drive-upload.service';
import { FilePreviewService } from '../../shared/file-preview/file-preview.service';
import { TaLogComponent } from './ta-log.component';

const CAT = 'Travel Authority';

// Travel Authority (DepEd Order No. 043, s. 2022): Working Directory (apply, sign, log)
// and File Storage (old or scanned copies, by school year).
@Component({
  selector: 'app-travel-authority',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, TaLogComponent],
  template: `
    <div class="tabs sub">
      <button type="button" [class.on]="sub === 'working'" (click)="sub = 'working'">Working Directory</button>
      <button type="button" [class.on]="sub === 'storage'" (click)="sub = 'storage'">File Storage</button>
    </div>
    @if (error) { <p class="error">{{ error }}</p> }
    @if (saving) { <div class="bar"><div class="fill" [style.width.%]="progress"></div></div> }
    @if (msg) { <p class="muted">{{ msg }}</p> }

    @if (sub === 'working') {
      <div class="card tip">
        <strong>Where these go</strong>
        <span>One Word file per Travel Authority in <em>TaskEd Files</em> › <em>Working Directory</em> › <em>Travel Authority</em> in your own Google Drive. It is replaced with the signed version as people sign.</span>
      </div>
      <app-ta-log />
    } @else {
      <div class="card tip">
        <strong>Where these go</strong>
        <span><em>TaskEd Files</em> › <em>Travel Authority</em> › <em>S.Y.</em> in your own Google Drive. Keep signed or scanned copies here.</span>
      </div>
      <form class="card up" (ngSubmit)="upload()">
        <h3>Upload a signed or scanned copy</h3>
        <div class="grid">
          <label>School year
            <select name="sy" [(ngModel)]="schoolYear">@for (y of yearChoices; track y) { <option [value]="y">S.Y. {{ y }}</option> }</select>
          </label>
          <label class="wide">File * (PDF, Word, picture… up to 25 MB)
            <input type="file" name="file" (change)="onFile($event)" />
          </label>
          <label class="wide">Label *
            <input name="label" [(ngModel)]="label" placeholder="e.g. Travel Authority – Training, May 2026" maxlength="150" />
          </label>
        </div>
        <div class="row"><button class="btn" type="submit" [disabled]="saving || !file || !label.trim()">Upload to my Drive</button></div>
      </form>
      @for (g of groups; track g.sy) {
        <section class="card year">
          <div class="year-head static"><strong>S.Y. {{ g.sy }}</strong> <span class="muted">{{ g.files.length }} file{{ g.files.length === 1 ? '' : 's' }}</span></div>
          @for (f of g.files; track f.id) {
            <div class="frow">
              <div class="info"><strong>{{ f.label }}</strong><small>Added {{ f.createdAt | date: 'MMM d, y' }}</small></div>
              <div class="acts">
                <button class="btn secondary" type="button" (click)="preview.open(f.link, f.label)">Preview</button>
                <a class="btn secondary" [href]="f.link" target="_blank" rel="noopener noreferrer">Open</a>
                <button class="btn danger" type="button" (click)="remove(f)">Remove</button>
              </div>
            </div>
          }
        </section>
      } @empty { <p class="muted">No stored copies yet.</p> }
    }
  `,
  styleUrl: './my-files.component.scss',
  styles: [`.tabs.sub { margin-bottom: .8rem; } .year-head.static { cursor: default; display: flex; gap: .6rem; align-items: center; padding: .4rem 0; }`],
})
export class TravelAuthorityComponent implements OnInit {
  private api = inject(MyFilesService);
  private drive = inject(DriveUploadService);
  private auth = inject(AuthService);
  preview = inject(FilePreviewService);

  sub: 'working' | 'storage' = 'working';
  files: MyFile[] = [];
  currentYear = '';
  schoolYear = '';
  label = '';
  file: File | null = null;
  saving = false;
  progress = 0;
  msg = '';
  error = '';

  ngOnInit() { this.load(); }

  load() {
    this.api.list().subscribe({
      next: (v) => { this.currentYear = v.currentYear; if (!this.schoolYear) this.schoolYear = v.currentYear; this.files = v.files.filter((f) => f.category === CAT && f.section !== 'working'); },
      error: (e) => (this.error = e?.error?.message ?? 'Could not load your files.'),
    });
  }
  get yearChoices(): string[] {
    const s = Number(this.currentYear.slice(0, 4));
    return s ? Array.from({ length: 5 }, (_, i) => `${s - i}-${s - i + 1}`) : [];
  }
  get groups(): { sy: string; files: MyFile[] }[] {
    const m = new Map<string, MyFile[]>();
    for (const f of this.files) m.set(f.schoolYear, [...(m.get(f.schoolYear) ?? []), f]);
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([sy, files]) => ({ sy, files }));
  }

  onFile(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0] ?? null;
    this.error = '';
    if (f && f.size > MAX_UPLOAD_BYTES) { this.error = 'That file is bigger than 25 MB.'; this.file = null; return; }
    this.file = f;
    if (f && !this.label.trim()) this.label = f.name.replace(/\.[^.]+$/, '');
  }

  async upload() {
    if (!this.file || !this.label.trim() || this.saving) return;
    this.error = ''; this.saving = true; this.progress = 0; this.msg = 'Asking Google for permission…';
    try {
      const token = await this.drive.accessToken(this.auth.currentUser()?.depedEmail);
      const parent = await this.drive.ensureFolder(token, CAT, this.schoolYear);
      this.msg = 'Uploading…';
      const up = await this.drive.upload(token, parent, this.file, (p) => (this.progress = p));
      await firstValueFrom(this.api.add(this.label.trim(), CAT, up.link, this.schoolYear));
      this.label = ''; this.file = null;
      this.msg = 'Uploaded to your Google Drive.';
      this.load();
    } catch (e: any) { this.msg = ''; this.error = e?.error?.message ?? e?.message ?? 'Could not upload.'; }
    this.saving = false;
  }

  async remove(f: MyFile) {
    if (!confirm(`Remove "${f.label}"? It is also moved to the Trash in your Google Drive (you can restore it there for 30 days).`)) return;
    try {
      const id = DriveUploadService.fileId(f.link);
      if (id) await this.drive.trash(await this.drive.accessToken(this.auth.currentUser()?.depedEmail), id);
    } catch (e: any) {
      if (!confirm(`Could not delete it from your Drive (${e?.message ?? 'error'}). Remove it from this list anyway?`)) return;
    }
    this.api.remove(f.id).subscribe({ next: () => this.load(), error: (e) => (this.error = e?.error?.message ?? 'Could not delete the file.') });
  }
}
