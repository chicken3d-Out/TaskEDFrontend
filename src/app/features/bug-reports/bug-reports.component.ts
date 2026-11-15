import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { BugReportView, BugReportsService } from '../../core/services/bug-reports.service';
import { ROLE_LABELS } from '../../core/models/user.model';
import { IconComponent } from '../../shared/icon/icon.component';
import { LoadingComponent } from '../../shared/loading/loading.component';

// Administrator: the problems users reported.
@Component({
  selector: 'app-bug-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, IconComponent, LoadingComponent],
  template: `
    <h1 class="page-title"><app-icon name="bug" [size]="22" /> Bug reports</h1>
    <div class="tabs">
      <button type="button" [class.on]="show === 'open'" (click)="show = 'open'">Open <b>{{ count('open') }}</b></button>
      <button type="button" [class.on]="show === 'resolved'" (click)="show = 'resolved'">Resolved <b>{{ count('resolved') }}</b></button>
    </div>
    @if (error) { <p class="error">{{ error }}</p> }
    @if (!loaded) { <app-loading [compact]="true" label="Loading reports…" /> }
    @for (b of shown(); track b.id) {
      <article class="card rep" [class.res]="b.status === 'resolved'">
        <div class="top">
          <span class="ico"><app-icon [name]="b.status === 'resolved' ? 'check' : 'alert'" [size]="18" /></span>
          <div class="ttl"><strong>{{ b.title }}</strong>
            <small>{{ b.reporter?.name || 'A deleted user' }}@if (b.reporter?.role) { · {{ roleName(b.reporter!.role!) }} } · {{ b.createdAt | date: 'MMM d, y, h:mm a' }}</small></div>
          <span class="chip" [class.ok]="b.status === 'resolved'">{{ b.status === 'resolved' ? 'Resolved' : 'Open' }}</span>
        </div>
        <p class="desc">{{ b.description }}</p>
        <div class="meta">
          @if (b.page) { <span><app-icon name="list" [size]="13" /> {{ b.page }}</span> }
          @if (b.reporter?.email) { <span>{{ b.reporter!.email }}</span> }
          @if (b.userAgent) { <span class="ua">{{ b.userAgent }}</span> }
        </div>
        <label class="note">Note (optional)<input [(ngModel)]="notes[b.id]" [placeholder]="b.adminNote || 'e.g. fixed in the next update'" /></label>
        <div class="acts">
          @if (b.status === 'open') { <button class="btn" type="button" (click)="set(b, 'resolved')" [disabled]="busy === b.id"><app-icon name="check" [size]="16" /> Mark resolved</button> }
          @else { <button class="btn secondary" type="button" (click)="set(b, 'open')" [disabled]="busy === b.id">Reopen</button> }
          <button class="btn danger" type="button" (click)="remove(b)" [disabled]="busy === b.id"><app-icon name="trash" [size]="16" /> Delete</button>
        </div>
      </article>
    } @empty { @if (loaded) { <div class="card empty"><app-icon name="check" [size]="26" /><p>{{ show === 'open' ? 'No open bug reports. Nice.' : 'Nothing resolved yet.' }}</p></div> } }
  `,
  styles: [`
    .tabs { display: flex; gap: .4rem; margin-bottom: 1rem; flex-wrap: wrap; }
    .tabs button { border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 999px; padding: .4rem 1rem; font-weight: 600; }
    .tabs button.on { background: var(--primary); color: #fff; border-color: var(--primary); } .tabs b { margin-left: .3rem; opacity: .85; }
    .rep { margin-bottom: .8rem; display: flex; flex-direction: column; gap: .6rem; border-left: 4px solid var(--danger); } .rep.res { border-left-color: var(--primary); }
    .top { display: flex; align-items: flex-start; gap: .7rem; } .ico { background: var(--err-bg); color: var(--err-fg); border-radius: 10px; width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; flex: none; }
    .res .ico { background: var(--ok-bg); color: var(--ok-fg); } .ttl { flex: 1; min-width: 0; display: flex; flex-direction: column; } .ttl small { color: var(--muted); }
    .chip.ok { background: var(--ok-bg); color: var(--ok-fg); } .desc { margin: 0; white-space: pre-wrap; }
    .meta { display: flex; flex-wrap: wrap; gap: .3rem .9rem; font-size: .78rem; color: var(--muted); } .meta span { display: inline-flex; align-items: center; gap: .25rem; max-width: 100%; } .ua { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .note { display: flex; flex-direction: column; gap: .2rem; font-size: .8rem; font-weight: 600; } .acts { display: flex; gap: .5rem; flex-wrap: wrap; }
    .empty { text-align: center; color: var(--muted); display: flex; flex-direction: column; align-items: center; gap: .4rem; }
  `],
})
export class BugReportsComponent implements OnInit {
  private api = inject(BugReportsService);
  items: BugReportView[] = []; loaded = false; error = ''; busy = ''; show: 'open' | 'resolved' = 'open';
  notes: Record<string, string> = {};
  roleName(r: string) { return (ROLE_LABELS as Record<string, string>)[r] ?? r; }
  count(s: 'open' | 'resolved') { return this.items.filter((x) => x.status === s).length; }
  shown() { return this.items.filter((x) => x.status === this.show); }

  async ngOnInit() { await this.load(); }
  async load() {
    try { this.items = await firstValueFrom(this.api.list()); this.error = ''; } catch (e: any) { this.error = e?.error?.message ?? 'Could not load the reports.'; }
    this.loaded = true;
  }
  async set(b: BugReportView, status: 'open' | 'resolved') {
    this.busy = b.id;
    try { const v = await firstValueFrom(this.api.setStatus(b.id, { status, note: this.notes[b.id] || undefined })); Object.assign(b, v); } catch (e: any) { this.error = e?.error?.message ?? 'Could not save.'; }
    this.busy = '';
  }
  async remove(b: BugReportView) {
    if (!confirm('Delete this report?')) return;
    this.busy = b.id;
    try { await firstValueFrom(this.api.remove(b.id)); this.items = this.items.filter((x) => x.id !== b.id); } catch (e: any) { this.error = e?.error?.message ?? 'Could not delete.'; }
    this.busy = '';
  }
}
