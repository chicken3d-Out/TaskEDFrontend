import { Component, effect, inject, untracked } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { TaNumbering, TravelAuthorityService } from '../../core/services/travel-authority.service';
import { TaSignService } from '../../shared/travel-authority/ta-sign.service';

interface Row extends TaNumbering { level: string; month: number; seq: string; busy: boolean; error: string; editing: boolean }

// DS Secretary: give each fully signed Travel Authority its official number (e.g. E-11-205),
// which is printed in the "No.:" box at the upper right of the form.
@Component({
  selector: 'app-ta-numbering',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    <p class="muted">Fully signed Travel Authorities wait here for a number. <strong>E</strong> = Elementary, <strong>S</strong> = Secondary, then the month, then the running number you type, for example <strong>E-11-205</strong>. The number is printed in the upper-right corner of the form, and the applicant's Drive copy updates.</p>
    @if (error) { <p class="error">{{ error }}</p> }
    <h3>Waiting for a number ({{ waiting.length }})</h3>
    @for (r of waiting; track r.id) { <ng-container *ngTemplateOutlet="row; context: { $implicit: r }"></ng-container> }
    @if (!waiting.length) { <p class="muted">{{ loaded ? 'Nothing is waiting for a number.' : 'Loading…' }}</p> }
    <h3>Numbered ({{ done.length }})</h3>
    @for (r of done; track r.id) { <ng-container *ngTemplateOutlet="row; context: { $implicit: r }"></ng-container> }

    <ng-template #row let-r>
      <div class="card item">
        <div class="info">
          <strong>{{ r.name }}</strong>
          <small>{{ r.dates || 'No dates' }} → {{ r.destination || 'No destination' }}</small>
          <small>Signed {{ r.approvedAt | date: 'mediumDate' }}@if (r.taNumber) { · <span class="chip">No. {{ r.taNumber }}</span> }</small>
        </div>
        <div class="acts">
          <button class="btn secondary" type="button" (click)="view(r)">Preview</button>
          @if (!r.taNumber || r.editing) {
            <select [(ngModel)]="r.level" aria-label="Elementary or Secondary"><option value="E">E – Elementary</option><option value="S">S – Secondary</option></select>
            <select [(ngModel)]="r.month" aria-label="Month">@for (m of months; track m) { <option [ngValue]="m">{{ m }}</option> }</select>
            <input type="text" inputmode="numeric" maxlength="6" placeholder="No." [(ngModel)]="r.seq" aria-label="Running number" />
            <button class="btn" type="button" (click)="save(r)" [disabled]="r.busy || !r.seq">{{ r.busy ? 'Saving…' : 'Save number' }}</button>
            <span class="pv">{{ r.level }}-{{ r.month }}-{{ r.seq || '…' }}</span>
          } @else { <button class="btn secondary" type="button" (click)="r.editing = true">Change</button> }
        </div>
        @if (r.error) { <p class="error">{{ r.error }}</p> }
      </div>
    </ng-template>
  `,
  styles: [`
    .muted { color: #6b7280; font-size: .88rem; } .error { color: #b91c1c; } h3 { margin: 1.1rem 0 .4rem; }
    .item { padding: .7rem 1rem; margin-bottom: .5rem; display: flex; flex-wrap: wrap; gap: .6rem 1rem; justify-content: space-between; align-items: center; }
    .info { display: flex; flex-direction: column; gap: .1rem; min-width: 0; } .info small { color: #6b7280; }
    .acts { display: flex; gap: .4rem; flex-wrap: wrap; align-items: center; }
    .acts input { width: 5rem; } select, input { padding: .4rem .5rem; border: 1px solid #d1d5db; border-radius: 8px; font: inherit; }
    .chip { background: #dcfce7; color: #166534; border-radius: 999px; padding: .05rem .55rem; font-size: .75rem; }
    .pv { font-weight: 700; color: #166534; } .item .error { flex-basis: 100%; margin: 0; }
  `],
})
export class TaNumberingComponent {
  private api = inject(TravelAuthorityService);
  private signer = inject(TaSignService);
  rows: Row[] = [];
  loaded = false;
  error = '';
  months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  get waiting() { return this.rows.filter((r) => !r.taNumber); }
  get done() { return this.rows.filter((r) => !!r.taNumber); }

  constructor() { effect(() => { this.api.version(); untracked(() => this.load()); }); }

  private load() {
    firstValueFrom(this.api.numbering()).then((rows) => {
      const month = new Date().getMonth() + 1;
      this.rows = rows.map((r) => {
        const m = /^([ES])-(\d{1,2})-(\d+)$/.exec(r.taNumber ?? '');
        return { ...r, level: m?.[1] ?? 'E', month: m ? +m[2] : month, seq: m?.[3] ?? '', busy: false, error: '', editing: false };
      });
      this.loaded = true;
    }).catch((e) => { this.loaded = true; this.error = e?.error?.message ?? 'Could not load the list.'; });
  }

  view(r: Row) { this.signer.open(r.id); }

  async save(r: Row) {
    r.busy = true; r.error = '';
    try { await firstValueFrom(this.api.setNumber(r.id, { level: r.level, month: r.month, seq: r.seq })); this.api.bump(); }
    catch (e: any) { r.error = e?.error?.message ?? 'Could not save the number.'; }
    r.busy = false;
  }
}
