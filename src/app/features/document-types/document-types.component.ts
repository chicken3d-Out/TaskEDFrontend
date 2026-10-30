import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SchoolPortalService } from '../../core/services/school-portal.service';
import { DocumentType } from '../../core/models/school-portal.model';
import { LoadingComponent } from '../../shared/loading/loading.component';
import { IconComponent } from '../../shared/icon/icon.component';

interface Row {
  type: DocumentType;
  editing: boolean;
  name: string;
  description: string;
  required: boolean;
  error: string | null;
}

// The Administrator decides which documents every school must upload
// (for example the Annual Implementation Plan).
@Component({
  selector: 'app-document-types',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingComponent, IconComponent],
  template: `
    <h1 class="page-title">School documents</h1>
    <p class="muted">These are the documents schools see in their <b>School files</b> tab. Each one has a soft copy and a scanned copy slot.</p>

    <form class="card add" (ngSubmit)="add()">
      <input [(ngModel)]="name" name="name" placeholder="Document name, e.g. Annual Implementation Plan" required />
      <input [(ngModel)]="description" name="description" placeholder="Short description (optional)" />
      <label class="chk"><input type="checkbox" [(ngModel)]="required" name="required" /> Required</label>
      <button class="btn" type="submit" [disabled]="!name.trim() || adding"><app-icon name="plus" [size]="16" /> Add</button>
    </form>
    @if (addError) { <p class="error">{{ addError }}</p> }

    @if (loading) {
      <app-loading [compact]="true" />
    } @else if (rows.length === 0) {
      <div class="card empty">No documents yet. Add the first one above.</div>
    }
    <div class="list">
      @for (r of rows; track r.type.id) {
        <div class="card" [class.hidden]="!r.type.active">
          @if (!r.editing) {
            <div class="line">
              <app-icon name="file-text" [size]="20" />
              <div class="main">
                <strong>{{ r.type.name }}</strong>
                @if (r.type.required) { <span class="req">Required</span> }
                @if (!r.type.active) { <span class="off">Hidden from schools</span> }
                @if (r.type.description) { <small>{{ r.type.description }}</small> }
              </div>
              <div class="actions">
                <button class="btn secondary" (click)="r.editing = true"><app-icon name="pencil" [size]="15" /> Edit</button>
                <button class="btn secondary" (click)="toggleActive(r)">{{ r.type.active ? 'Hide' : 'Show' }}</button>
                <button class="btn danger" (click)="remove(r)"><app-icon name="trash" [size]="15" /></button>
              </div>
            </div>
          } @else {
            <div class="edit">
              <input [(ngModel)]="r.name" name="n{{ r.type.id }}" />
              <input [(ngModel)]="r.description" name="d{{ r.type.id }}" placeholder="Description" />
              <label class="chk"><input type="checkbox" [(ngModel)]="r.required" name="r{{ r.type.id }}" /> Required</label>
              <button class="btn" (click)="save(r)">Save</button>
              <button class="btn secondary" (click)="r.editing = false">Cancel</button>
            </div>
          }
          @if (r.error) { <p class="error">{{ r.error }}</p> }
        </div>
      }
    </div>
  `,
  styles: [`
    .muted { color: var(--muted); font-size: 0.88rem; }
    .add, .edit { display: flex; gap: 0.6rem; flex-wrap: wrap; align-items: center; margin: 0.8rem 0 1rem; }
    .edit { margin: 0; }
    .add input[type=text], .add input:not([type]), .edit input:not([type=checkbox]) { flex: 1; min-width: 200px; }
    .chk { display: inline-flex; gap: 0.4rem; align-items: center; font-size: 0.85rem; font-weight: 600; }
    .list { display: flex; flex-direction: column; gap: 0.7rem; }
    .line { display: flex; gap: 0.8rem; align-items: center; flex-wrap: wrap; color: var(--primary-strong); }
    .main { flex: 1; min-width: 200px; display: flex; flex-direction: column; color: var(--text); }
    small { color: var(--muted); }
    .actions { display: flex; gap: 0.5rem; }
    .hidden { opacity: 0.65; }
    .req { align-self: flex-start; background: #fee2e2; color: #991b1b; border-radius: 999px; font-size: 0.68rem; font-weight: 700; padding: 0.05rem 0.5rem; margin: 0.15rem 0; }
    .off { align-self: flex-start; background: #e5e7eb; color: #374151; border-radius: 999px; font-size: 0.68rem; font-weight: 700; padding: 0.05rem 0.5rem; margin: 0.15rem 0; }
    .empty { text-align: center; color: var(--muted); }
  `],
})
export class DocumentTypesComponent implements OnInit {
  private portal = inject(SchoolPortalService);
  rows: Row[] = [];
  loading = true;
  name = '';
  description = '';
  required = false;
  adding = false;
  addError: string | null = null;

  ngOnInit() {
    this.load();
  }

  private load() {
    this.portal.types().subscribe({
      next: (types) => {
        this.rows = types.map((type) => ({
          type,
          editing: false,
          name: type.name,
          description: type.description ?? '',
          required: type.required,
          error: null,
        }));
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  add() {
    this.adding = true;
    this.addError = null;
    this.portal.createType({ name: this.name, description: this.description, required: this.required }).subscribe({
      next: () => {
        this.name = '';
        this.description = '';
        this.required = false;
        this.adding = false;
        this.load();
      },
      error: (e) => {
        this.addError = e?.error?.message ?? 'Could not add.';
        this.adding = false;
      },
    });
  }

  save(r: Row) {
    this.portal.updateType(r.type.id, { name: r.name, description: r.description, required: r.required }).subscribe({
      next: () => this.load(),
      error: (e) => (r.error = e?.error?.message ?? 'Could not save.'),
    });
  }

  toggleActive(r: Row) {
    this.portal.updateType(r.type.id, { active: !r.type.active }).subscribe(() => this.load());
  }

  remove(r: Row) {
    if (!confirm(`Delete "${r.type.name}"?`)) return;
    this.portal.deleteType(r.type.id).subscribe({
      next: () => this.load(),
      error: (e) => (r.error = e?.error?.message ?? 'Could not delete.'),
    });
  }
}
