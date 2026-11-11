import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SrEditorService } from './sr-editor.service';
import { COLS, FIELDS, SECTIONS, SR_CAP, Row, SrData, SrFormatError, SrPackage, buildSr, openSr, readSr } from './sr-engine';

@Component({
  selector: 'app-sr-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (svc.current(); as req) {
      <div class="backdrop" (click)="tryClose()"></div>
      <div class="panel" role="dialog" aria-modal="true" aria-label="Service Record editor">
        <header>
          <div>
            <h2>Service Record</h2>
            <small>{{ req.title }}</small>
          </div>
          <div class="hbtns">
            @if (data) {
              <button class="btn secondary" type="button" (click)="download()" [disabled]="busy">Download .xlsx</button>
              @if (req.save) { <button class="btn" type="button" (click)="save()" [disabled]="busy">{{ busy ? 'Saving…' : req.save.label }}</button> }
            }
            <button class="btn secondary" type="button" (click)="tryClose()">Close</button>
          </div>
        </header>

        @if (loading) { <p class="muted pad">Reading your file…</p> }
        @if (error) { <p class="error pad">{{ error }}</p> }
        @if (msg) { <p class="ok pad">{{ msg }}</p> }

        @if (data) {
          <nav class="chips">
            @for (s of sections; track s.id) { <button type="button" [class.on]="active === s.id" (click)="active = s.id">{{ s.title }}</button> }
          </nav>
          @if (dirty()) { <p class="muted pad">You have unsaved changes. Save or download to keep them.</p> }
          <div class="body">
            @if (active !== 'service') {
              <div class="grid">
                @for (f of fieldsOf(active); track f.id) {
                  <label [class.wide]="f.wide">{{ f.label }}
                    @if (f.type === 'date') { <input type="date" [name]="f.id" [(ngModel)]="data.fields[f.id]" (ngModelChange)="touch()" /> }
                    @else { <input [name]="f.id" [(ngModel)]="data.fields[f.id]" (ngModelChange)="touch()" /> }
                  </label>
                }
              </div>
              @if (active === 'cert') { <p class="muted">The date above "Certified correct" is set to the day you download or save.</p> }
            } @else {
              <h3>Service lines</h3>
              @for (row of data.rows; track $index; let i = $index) {
                <div class="entry">
                  <div class="ehead"><strong>Line {{ i + 1 }}</strong><button type="button" class="link danger" (click)="removeRow(i)">Remove</button></div>
                  <div class="grid">
                    @for (c of cols; track c.key) {
                      <label [class.wide]="c.wide">{{ c.label }}
                        @if (c.type === 'date') { <input type="date" [name]="c.key + i" [(ngModel)]="row[c.key]" (ngModelChange)="touch()" /> }
                        @else if (c.type === 'dateOrPresent') {
                          <span class="dp">
                            <input type="date" [name]="c.key + i" [ngModel]="row[c.key] === 'PRESENT' ? '' : row[c.key]" (ngModelChange)="row[c.key] = $event; touch()" [disabled]="row[c.key] === 'PRESENT'" />
                            <label class="opt"><input type="checkbox" [name]="c.key + i + 'p'" [ngModel]="row[c.key] === 'PRESENT'" (ngModelChange)="row[c.key] = $event ? 'PRESENT' : ''; touch()" /> Present</label>
                          </span>
                        }
                        @else { <input [name]="c.key + i" [(ngModel)]="row[c.key]" (ngModelChange)="touch()" /> }
                      </label>
                    }
                  </div>
                </div>
              }
              @if (!data.rows.length) { <p class="muted">No lines yet.</p> }
              <button type="button" class="btn secondary" (click)="addRow()">+ Add service line</button>
              @if (data.rows.length > cap) { <p class="muted">The form prints {{ cap }} lines; extra lines are added to the table and the page shrinks to keep it on one sheet.</p> }
            }
          </div>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: contents; }
    .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 1100; }
    .panel { position: fixed; z-index: 1101; inset: 0 0 0 auto; width: min(980px, 100%); background: #fff; display: flex; flex-direction: column; overflow: hidden; }
    header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; padding: 1rem 1.2rem; border-bottom: 1px solid #e5e7eb; flex-wrap: wrap; }
    header h2 { margin: 0; } header small { color: #6b7280; }
    .hbtns { display: flex; gap: .5rem; flex-wrap: wrap; }
    .chips { display: flex; gap: .4rem; padding: .7rem 1.2rem; overflow-x: auto; border-bottom: 1px solid #f1f5f9; }
    .chips button { white-space: nowrap; border: 1px solid #e5e7eb; background: #fff; border-radius: 999px; padding: .4rem .9rem; font: inherit; cursor: pointer; }
    .chips button.on { background: #15803d; color: #fff; border-color: #15803d; }
    .body { padding: 1rem 1.2rem 3rem; overflow-y: auto; flex: 1; }
    fieldset.ro { border: 0; padding: 0; margin: 0; min-width: 0; }
    .pad { padding: .6rem 1.2rem 0; margin: 0; }
    h3 { margin: 1.2rem 0 .4rem; font-size: 1rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: .6rem .8rem; }
    label { display: flex; flex-direction: column; gap: .2rem; font-size: .82rem; font-weight: 600; }
    label.wide { grid-column: span 2; }
    input:not([type=radio]), select { padding: .5rem .6rem; border: 1px solid #d1d5db; border-radius: 8px; font: inherit; font-weight: 400; }
    .opts { display: flex; flex-wrap: wrap; gap: .4rem 1rem; }
    .opt { flex-direction: row; align-items: center; gap: .4rem; font-weight: 400; font-size: .9rem; } .opt.clear { color: #6b7280; }
    .entry { border: 1px solid #e5e7eb; border-radius: 10px; padding: .7rem .8rem; margin-bottom: .6rem; }
    .ehead { display: flex; justify-content: space-between; margin-bottom: .4rem; }
    .link { background: none; border: 0; cursor: pointer; font: inherit; } .danger { color: #b91c1c; }
    .q { border-bottom: 1px solid #f1f5f9; padding: .6rem 0; } .q p { margin: 0 0 .4rem; }
    .muted { color: #6b7280; font-size: .85rem; } .ok { color: #166534; } .error { color: #b91c1c; }
    @media (max-width: 600px) { label.wide { grid-column: span 1; } }
      .dp { display: flex; gap: .6rem; align-items: center; } .dp > input { flex: 1; }
  `],
})
export class SrEditorComponent {
  svc = inject(SrEditorService);
  sections = SECTIONS;
  cols = COLS;
  cap = SR_CAP;
  active = 'employee';
  data: SrData | null = null;
  loading = false;
  busy = false;
  error = '';
  msg = '';
  dirty = signal(false);
  private pkg: SrPackage | null = null;

  constructor() {
    effect(() => {
      const r = this.svc.current();
      this.data = null; this.pkg = null; this.error = ''; this.msg = ''; this.dirty.set(false); this.active = 'employee';
      if (!r) return;
      this.loading = true;
      r.load()
        .then((buf) => openSr(buf))
        .then((pkg) => { this.pkg = pkg; this.data = readSr(pkg); this.loading = false; })
        .catch((e) => {
          this.loading = false;
          this.error = e instanceof SrFormatError ? e.message : (e?.message ?? 'Could not open this file.');
        });
    }, { allowSignalWrites: true });
  }

  touch() { this.dirty.set(true); this.msg = ''; }
  fieldsOf(section: string) { return FIELDS.filter((f) => f.section === section); }
  addRow() { const row: Row = {}; for (const c of COLS) row[c.key] = ''; this.data!.rows.push(row); this.touch(); }
  removeRow(i: number) { this.data!.rows.splice(i, 1); this.touch(); }

  async download() {
    this.busy = true; this.error = '';
    try {
      const b = await buildSr(this.pkg!, this.data!);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = this.svc.current()!.fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      this.dirty.set(false);
    } catch (e: any) { this.error = e?.message ?? 'Could not build the file.'; }
    this.busy = false;
  }

  async save() {
    const req = this.svc.current();
    if (!req?.save) return;
    this.busy = true; this.error = ''; this.msg = '';
    try {
      const b = await buildSr(this.pkg!, this.data!);
      const r = await req.save.run(b, req.fileName);
      this.msg = (r as string) || 'Saved.';
      this.dirty.set(false);
    } catch (e: any) { this.error = e?.message ?? 'Could not save.'; }
    this.busy = false;
  }

  tryClose() {
    if (this.dirty() && !confirm('You have unsaved changes. Close without saving?')) return;
    this.svc.close();
  }
}
