import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MyFilesService } from '../../core/services/my-files.service';
import { MyFile, MyFilesView } from '../../core/models/my-files.model';
import { LoadingComponent } from '../../shared/loading/loading.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { GoogleConnectComponent } from '../../shared/google-connect/google-connect.component';
import { saveBlob } from '../../shared/download';

interface YearGroup {
  schoolYear: string;
  files: MyFile[];
}

// A personal space for Teachers, School Heads and AOs. Every file goes to the
// person's own Google Drive: TaskEd / My Files / S.Y. xxxx-xxxx / <category>.
@Component({
  selector: 'app-my-files',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, LoadingComponent, IconComponent, GoogleConnectComponent],
  templateUrl: './my-files.component.html',
  styleUrl: './my-files.component.scss',
})
export class MyFilesComponent implements OnInit {
  private api = inject(MyFilesService);

  view: MyFilesView | null = null;
  loading = true;
  error: string | null = null;

  // upload form
  label = '';
  category = '';
  picked: File | null = null;
  uploading = false;
  readonly maxMb = 20;

  // which school years are open (the current one starts open)
  private opened = new Set<string>();
  private closed = new Set<string>();

  // rename
  editingId: string | null = null;
  editLabel = '';
  editCategory = '';

  ngOnInit() {
    this.load();
  }

  load() {
    this.api.list().subscribe({
      next: (v) => {
        this.view = v;
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
    map.set(v.currentYear, []);
    for (const f of v.files) map.set(f.schoolYear, [...(map.get(f.schoolYear) ?? []), f]);
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([schoolYear, files]) => ({ schoolYear, files }));
  }

  // Files of one year, grouped by the category the person typed.
  byCategory(files: MyFile[]): { name: string; files: MyFile[] }[] {
    const map = new Map<string, MyFile[]>();
    for (const f of files) {
      const k = f.category || 'Uncategorized';
      map.set(k, [...(map.get(k) ?? []), f]);
    }
    return [...map.entries()]
      .sort((a, b) => (a[0] === 'Uncategorized' ? 1 : b[0] === 'Uncategorized' ? -1 : a[0].localeCompare(b[0])))
      .map(([name, list]) => ({ name, files: list }));
  }

  get categories(): string[] {
    return [...new Set((this.view?.files ?? []).map((f) => f.category).filter((c): c is string => !!c))].sort();
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

  pick(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    this.error = null;
    if (file && file.size > this.maxMb * 1024 * 1024) {
      this.error = `That file is larger than ${this.maxMb} MB.`;
      return;
    }
    this.picked = file;
    if (file && !this.label.trim()) this.label = file.name.replace(/\.[^.]+$/, '');
  }

  upload() {
    if (!this.picked || !this.label.trim()) return;
    this.uploading = true;
    this.error = null;
    this.api.upload(this.picked, this.label.trim(), this.category.trim()).subscribe({
      next: () => {
        this.picked = null;
        this.label = '';
        this.uploading = false;
        this.load();
      },
      error: (e) => {
        this.error = e?.error?.message ?? 'Upload failed.';
        this.uploading = false;
      },
    });
  }

  download(f: MyFile) {
    this.api.download(f.id).subscribe({
      next: (b) => saveBlob(b, f.fileName),
      error: () => (this.error = 'Could not download the file. Try again.'),
    });
  }

  startEdit(f: MyFile) {
    this.editingId = f.id;
    this.editLabel = f.label;
    this.editCategory = f.category ?? '';
  }
  saveEdit(f: MyFile) {
    if (!this.editLabel.trim()) return;
    this.api.rename(f.id, this.editLabel.trim(), this.editCategory.trim()).subscribe({
      next: () => {
        this.editingId = null;
        this.load();
      },
      error: (e) => (this.error = e?.error?.message ?? 'Could not save.'),
    });
  }

  remove(f: MyFile) {
    if (!confirm(`Delete "${f.label}"? It is also removed from your Google Drive.`)) return;
    this.api.remove(f.id).subscribe({
      next: () => this.load(),
      error: (e) => (this.error = e?.error?.message ?? 'Could not delete the file.'),
    });
  }

  size(bytes: number): string {
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    return Math.max(1, Math.round(bytes / 1024)) + ' KB';
  }
}
