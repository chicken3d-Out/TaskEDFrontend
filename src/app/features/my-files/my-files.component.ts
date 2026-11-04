import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MyFilesService } from '../../core/services/my-files.service';
import { MyFile, MyFilesView } from '../../core/models/my-files.model';
import { FilePreviewService } from '../../shared/file-preview/file-preview.service';
import { AuthService } from '../../core/services/auth.service';
import { LoadingComponent } from '../../shared/loading/loading.component';
import { IconComponent } from '../../shared/icon/icon.component';

interface YearGroup {
  schoolYear: string;
  files: MyFile[];
}

// A personal, organised list of links for Teachers, School Heads and AOs. Every file stays in the
// person's own Google Drive / OneDrive. TaskEd keeps only the share link, a label,
// a category and the school year, so nothing is uploaded or shared with TaskEd.
@Component({
  selector: 'app-my-files',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, LoadingComponent, IconComponent],
  templateUrl: './my-files.component.html',
  styleUrl: './my-files.component.scss',
})
export class MyFilesComponent implements OnInit {
  private api = inject(MyFilesService);
  preview = inject(FilePreviewService);
  auth = inject(AuthService);
  newFolder = false;
  schoolYear = '';

  view: MyFilesView | null = null;
  loading = true;
  error: string | null = null;

  // add form
  label = '';
  category = '';
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
    this.load();
  }

  load() {
    this.api.list().subscribe({
      next: (v) => {
        this.view = v;
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

  // S.Y. choices for the add form: current year plus the previous five and any year already used.
  get yearChoices(): string[] {
    const cur = this.view?.currentYear ?? '';
    const start = Number(cur.slice(0, 4));
    const set = new Set<string>([cur, ...(this.view?.files ?? []).map((f) => f.schoolYear)]);
    if (start) for (let i = 1; i <= 5; i++) set.add(`${start - i}-${start - i + 1}`);
    return [...set].sort((a, b) => b.localeCompare(a));
  }

  onFolderPick(v: string) {
    if (v === '__new__') {
      this.newFolder = true;
      this.category = '';
    } else {
      this.newFolder = false;
      this.category = v;
    }
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

  add() {
    if (!this.label.trim() || !this.link.trim()) return;
    this.saving = true;
    this.error = null;
    this.api.add(this.label.trim(), this.category.trim(), this.link.trim(), this.schoolYear).subscribe({
      next: () => {
        this.label = '';
        this.link = '';
        this.newFolder = false;
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

  remove(f: MyFile) {
    if (!confirm(`Remove "${f.label}" from My files? The file itself stays in your Drive.`)) return;
    this.api.remove(f.id).subscribe({
      next: () => this.load(),
      error: (e) => (this.error = e?.error?.message ?? 'Could not delete the file.'),
    });
  }
}
