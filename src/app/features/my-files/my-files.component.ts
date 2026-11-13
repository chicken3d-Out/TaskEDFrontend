import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MyFilesService } from '../../core/services/my-files.service';
import { MyFile, MyFilesView } from '../../core/models/my-files.model';
import { FilePreviewService } from '../../shared/file-preview/file-preview.service';
import { AuthService } from '../../core/services/auth.service';
import { CATEGORIES, DriveUploadService, MAX_UPLOAD_BYTES } from '../../core/services/drive-upload.service';
import { Capacitor } from '@capacitor/core';
import { LoadingComponent } from '../../shared/loading/loading.component';
import { WorkingFilesComponent } from './working-files.component';
import { TravelAuthorityComponent } from './travel-authority.component';
import { IconComponent } from '../../shared/icon/icon.component';

interface YearGroup {
  schoolYear: string;
  files: MyFile[];
}

// My files: each person uploads to their OWN Google Drive (TaskEd Files / Personal Files or
// Scanned Files / S.Y.). TaskEd keeps only a link, so nobody else can see or open these files.
@Component({
  selector: 'app-my-files',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, LoadingComponent, IconComponent, WorkingFilesComponent, TravelAuthorityComponent],
  templateUrl: './my-files.component.html',
  styleUrl: './my-files.component.scss',
})
export class MyFilesComponent implements OnInit {
  private api = inject(MyFilesService);
  preview = inject(FilePreviewService);
  auth = inject(AuthService);
  drive = inject(DriveUploadService);
  tab: 'working' | 'storage' | 'travel' = 'working';
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  get canTravel() { return this.auth.currentUser()?.role !== 'school'; }
  go(t: 'working' | 'storage' | 'travel') { this.tab = t; this.router.navigate([], { queryParams: { tab: t }, replaceUrl: true }); }
  categories = [...CATEGORIES];
  schoolYear = '';
  // upload state
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;
  file: File | null = null;
  progress = 0;
  uploadMsg: string | null = null;
  newFolder = false;
  newFolderName = '';
  // pasting a link instead of uploading (also used inside the Android app,
  // where Google blocks its permission window)
  readonly pasteMode = Capacitor.isNativePlatform();
  category = 'Personal Files';

  view: MyFilesView | null = null;
  loading = true;
  error: string | null = null;

  // add form
  label = '';
  link = '';
  saving = false;

  // which school years are open (the current one starts open)
  private opened = new Set<string>();
  private closed = new Set<string>();

  // rename
  editingId: string | null = null;
  editLabel = '';
  editCategory = '';
  editLink = '';

  ngOnInit() {
    this.route.queryParamMap.subscribe((m) => {
      const t = m.get('tab');
      if (t === 'working' || t === 'storage' || (t === 'travel' && this.canTravel)) this.tab = t;
    });
    this.load();
  }

  load() {
    this.api.list().subscribe({
      next: (v) => {
        this.view = { ...v, files: v.files.filter((f) => f.section !== 'working') };
        if (!this.schoolYear) this.schoolYear = v.currentYear;
        this.loading = false;
      },
      error: (e) => {
        this.error = e?.error?.message ?? 'Could not load your files.';
        this.loading = false;
      },
    });
  }

  get groups(): YearGroup[] {
    const v = this.view;
    if (!v) return [];
    const map = new Map<string, MyFile[]>();
    // the current school year and the earlier ones always show, even when empty
    for (const y of [...this.yearChoices, ...this.oldYears]) map.set(y, []);
    for (const f of v.files) map.set(f.schoolYear, [...(map.get(f.schoolYear) ?? []), f]);
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([schoolYear, files]) => ({ schoolYear, files }));
  }

  // Files of one year: the two fixed folders first, then anything else.
  byCategory(files: MyFile[]): { name: string; files: MyFile[] }[] {
    const names = [...this.categories];
    for (const f of files) {
      const k = f.category || 'Uncategorized';
      if (!names.includes(k)) names.push(k);
    }
    return names.map((name) => ({ name, files: files.filter((f) => (f.category || 'Uncategorized') === name) }));
  }

  // The latest five school years. A new one appears by itself when the school
  // year opens in June (the current year comes from the server's date).
  // Personal Files and Scanned Files, plus any folder the person made before.
  get folderChoices(): string[] {
    const names = [...CATEGORIES];
    for (const f of this.view?.files ?? []) {
      const c = (f.category ?? '').trim();
      if (c && !names.includes(c)) names.push(c);
    }
    return names;
  }

  onFolderPick(v: string) {
    this.newFolder = v === '__new__';
    if (!this.newFolder) this.category = v;
  }

  // the folder the file will go to (a new name is created in Drive on upload)
  get chosenFolder(): string {
    return (this.newFolder ? this.newFolderName : this.category).trim().replace(/[\\/]+/g, ' ').slice(0, 60);
  }

  get yearChoices(): string[] {
    const cur = this.view?.currentYear ?? '';
    const start = Number(cur.slice(0, 4));
    const list: string[] = [];
    if (start) for (let i = 0; i < 5; i++) list.push(`${start - i}-${start - i + 1}`);
    return list;
  }

  private get years(): string[] {
    return this.yearChoices;
  }

  // Older years that already hold files stay visible after they leave the latest five.
  get oldYears(): string[] {
    const keep = new Set(this.yearChoices);
    return [...new Set((this.view?.files ?? []).map((f) => f.schoolYear))].filter((y) => !keep.has(y)).sort((a, b) => b.localeCompare(a));
  }

  onFile(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0] ?? null;
    this.uploadMsg = null;
    this.error = null;
    if (f && f.size > MAX_UPLOAD_BYTES) {
      this.error = 'That file is bigger than 25 MB. Please choose a smaller file.';
      this.file = null;
      return;
    }
    this.file = f;
    if (f && !this.label.trim()) this.label = f.name.replace(/\.[^.]+$/, '');
  }

  // Saves the chosen file into the person's own Drive, then keeps its link here.
  async upload() {
    const folder = this.chosenFolder;
    if (!this.file || !this.label.trim() || !folder || this.saving) return;
    this.saving = true;
    this.error = null;
    this.progress = 0;
    this.uploadMsg = 'Asking Google for permission…';
    try {
      const token = await this.drive.accessToken(this.auth.currentUser()?.depedEmail);
      this.uploadMsg = 'Preparing your folders…';
      const parent = await this.drive.ensureFolder(token, folder, this.schoolYear);
      this.uploadMsg = 'Uploading…';
      const up = await this.drive.upload(token, parent, this.file, (p) => (this.progress = p));
      this.uploadMsg = 'Saving to My files…';
      await firstValueFrom(this.api.add(this.label.trim(), folder, up.link, this.schoolYear));
      this.label = '';
      this.file = null;
      this.resetForm();
      this.uploadMsg = 'Uploaded to your Google Drive.';
      this.load();
    } catch (e: any) {
      this.uploadMsg = null;
      this.error = e?.error?.message ?? e?.message ?? 'Could not upload the file.';
    }
    this.saving = false;
  }

  // Empty the upload form again: file, label, folder (back to Personal Files) and the school year.
  private resetForm() {
    this.label = '';
    this.file = null;
    this.link = '';
    if (this.fileInput) this.fileInput.nativeElement.value = '';
    this.newFolder = false;
    this.newFolderName = '';
    this.category = CATEGORIES[0];
    this.schoolYear = this.view?.currentYear ?? this.schoolYear;
  }

  isOpen(sy: string): boolean {
    if (this.opened.has(sy)) return true;
    if (this.closed.has(sy)) return false;
    return sy === this.view?.currentYear;
  }
  toggle(sy: string) {
    if (this.isOpen(sy)) {
      this.opened.delete(sy);
      this.closed.add(sy);
    } else {
      this.closed.delete(sy);
      this.opened.add(sy);
    }
  }
  yearLabel(sy: string) {
    return 'S.Y. ' + sy;
  }

  add() {
    if (!this.label.trim() || !this.link.trim()) return;
    this.saving = true;
    this.error = null;
    this.api.add(this.label.trim(), this.chosenFolder, this.link.trim(), this.schoolYear).subscribe({
      next: () => {
        this.resetForm();
        this.saving = false;
        this.load();
      },
      error: (e) => {
        this.error = e?.error?.message ?? 'Could not save.';
        this.saving = false;
      },
    });
  }

  startEdit(f: MyFile) {
    this.editingId = f.id;
    this.editLabel = f.label;
    this.editCategory = f.category ?? '';
    this.editLink = f.link;
  }
  saveEdit(f: MyFile) {
    if (!this.editLabel.trim()) return;
    this.api.update(f.id, { label: this.editLabel.trim(), category: this.editCategory.trim(), link: this.editLink.trim() }).subscribe({
      next: () => {
        this.editingId = null;
        this.load();
      },
      error: (e) => (this.error = e?.error?.message ?? 'Could not save.'),
    });
  }

  async remove(f: MyFile) {
    if (!confirm(`Remove "${f.label}" from My files? It is also moved to the Trash in your Google Drive (you can restore it there for 30 days).`)) return;
    try {
      const id = DriveUploadService.fileId(f.link);
      if (id) await this.drive.trash(await this.drive.accessToken(this.auth.currentUser()?.depedEmail), id);
    } catch (e: any) {
      if (!confirm(`Could not delete it from your Drive (${e?.message ?? 'error'}). Remove it from this list anyway?`)) return;
    }
    this.api.remove(f.id).subscribe({
      next: () => this.load(),
      error: (e) => (this.error = e?.error?.message ?? 'Could not delete the file.'),
    });
  }
}
