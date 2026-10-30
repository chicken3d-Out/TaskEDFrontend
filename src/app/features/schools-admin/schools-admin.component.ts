import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SchoolPortalService } from '../../core/services/school-portal.service';
import { SchoolSummaryRow } from '../../core/models/school-portal.model';
import { LoadingComponent } from '../../shared/loading/loading.component';
import { IconComponent } from '../../shared/icon/icon.component';

@Component({
  selector: 'app-schools-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LoadingComponent, IconComponent],
  template: `
    <h1 class="page-title">Schools</h1>
    <input class="search" [(ngModel)]="search" placeholder="Search schools…" />
    @if (loading) {
      <app-loading [compact]="true" />
    } @else {
      <div class="list">
        @for (s of visible; track s.id) {
          <a class="card row" [routerLink]="['/schools', s.id]">
            <app-icon name="school" [size]="24" />
            <div class="main">
              <strong>{{ s.name }}</strong>
              <small>{{ s.district }} · Area {{ s.area }}</small>
            </div>
            <div class="meta">
              <span><b>{{ s.teachers }}</b> teachers @if (s.pendingTeachers) { <i class="pill">{{ s.pendingTeachers }} pending</i> }</span>
              <span>AO: {{ s.ao || '—' }}</span>
              <span>School account: {{ s.schoolAccount ? 'Yes' : 'None' }}</span>
              <span>Files: {{ s.documentsUploaded }}/{{ s.documentsTotal }}</span>
            </div>
          </a>
        }
      </div>
    }
  `,
  styles: [`
    .search { max-width: 340px; margin: 0.6rem 0 1rem; display: block; }
    .list { display: flex; flex-direction: column; gap: 0.7rem; }
    .row { display: flex; align-items: center; gap: 1rem; text-decoration: none; color: inherit; flex-wrap: wrap; }
    .row:hover { border-color: var(--primary); }
    .main { flex: 1; min-width: 200px; display: flex; flex-direction: column; }
    small { color: var(--muted); }
    .meta { display: flex; gap: 1.1rem; flex-wrap: wrap; font-size: 0.82rem; color: var(--muted); }
    .pill { background: #fef3c7; color: #92400e; font-style: normal; border-radius: 999px; padding: 0 0.45rem; font-size: 0.7rem; margin-left: 0.3rem; }
  `],
})
export class SchoolsAdminComponent implements OnInit {
  private portal = inject(SchoolPortalService);
  rows: SchoolSummaryRow[] = [];
  loading = true;
  search = '';

  ngOnInit() {
    this.portal.summary().subscribe({
      next: (r) => {
        this.rows = r;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  get visible() {
    const q = this.search.trim().toLowerCase();
    return q ? this.rows.filter((r) => r.name.toLowerCase().includes(q)) : this.rows;
  }
}
