import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SalnEditorService } from './saln-editor.service';
import { FIELDS, SECTIONS, SalnData, SalnFormatError, SalnPackage, TABLES, TableDef, Row, buildSaln, defaultFilingYear, openSaln, peso, readSaln, totals } from './saln-engine';

@Component({
  selector: 'app-saln-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (svc.current(); as req) {
      <div class="backdrop" (click)="tryClose()"></div>
      <div class="panel" role="dialog" aria-modal="true" aria-label="SALN editor">
        <header>
          <div>
            <h2>SALN</h2>
            <small>{{ req.title }} · Sworn Statement of Assets, Liabilities and Net Worth</small>
          </div>
          <div class="hbtns">
            @if (data) {
              <button class="btn secondary" type="button" (click)="download()" [disabled]="busy">Download .docx</button>
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
            @if (active === 'filing') {
              <h3>Compliance for</h3>
              <div class="opts">
                <label class="opt"><input type="radio" name="comp" value="assumption" [(ngModel)]="data.compliance" (ngModelChange)="touch()" /> Assumption of office</label>
                <label class="opt"><input type="radio" name="comp" value="annual" [(ngModel)]="data.compliance" (ngModelChange)="touch()" /> Annual filing</label>
                <label class="opt"><input type="radio" name="comp" value="exit" [(ngModel)]="data.compliance" (ngModelChange)="touch()" /> Exit</label>
              </div>
              <p class="muted">Annual filing is as of December 31 of the year below. The date beside the signature is set to the day you download or save.</p>
            }
            @if (active === 'declarant') {
              <h3>Spouses who are both public officials</h3>
              <div class="opts">
                <label class="opt"><input type="radio" name="fm" value="joint" [(ngModel)]="data.filingMode" (ngModelChange)="touch()" /> Joint filing</label>
                <label class="opt"><input type="radio" name="fm" value="separate" [(ngModel)]="data.filingMode" (ngModelChange)="touch()" /> Separate filing</label>
                <label class="opt"><input type="radio" name="fm" value="na" [(ngModel)]="data.filingMode" (ngModelChange)="touch()" /> Not applicable</label>
              </div>
              <label class="opt"><input type="checkbox" name="mna" [(ngModel)]="data.marriageNA" (ngModelChange)="touch()" /> Multiple marriages: not applicable</label>
            }
            <div class="grid">
              @for (f of fieldsOf(active); track f.id) {
                <label [class.wide]="f.wide">{{ f.label }}<input [name]="f.id" [(ngModel)]="data.fields[f.id]" (ngModelChange)="touch()" [placeholder]="f.hint ?? ''" /></label>
              }
            </div>

            @for (t of tablesOf(active); track t.id) {
              <h3>{{ t.title }}</h3>
              @if (t.id === 'business') { <label class="opt"><input type="checkbox" name="nb" [(ngModel)]="data.noBusiness" (ngModelChange)="touch()" /> I/We do not have any business interest or financial connection</label> }
              @if (t.id === 'relatives') { <label class="opt"><input type="checkbox" name="nr" [(ngModel)]="data.noRelatives" (ngModelChange)="touch()" /> I/We do not know of any relative/s in the government service</label> }
              @for (row of data.tables[t.id]; track $index; let i = $index) {
                <div class="entry">
                  <div class="ehead"><strong>{{ (t.rowLabel | titlecase) + ' ' + (i + 1) }}</strong><button type="button" class="link danger" (click)="removeRow(t, i)">Remove</button></div>
                  <div class="grid">
                    @for (c of t.cols; track c.key) {
                      <label [class.wide]="c.wide">{{ c.label }}<input [name]="t.id + i + c.key" [(ngModel)]="row[c.key]" (ngModelChange)="touch()" /></label>
                    }
                  </div>
                </div>
              }
              @if (!data.tables[t.id].length) { <p class="muted">None – the form will show N/A.</p> }
              <button type="button" class="btn secondary" (click)="addRow(t)">+ Add {{ t.rowLabel }}</button>
              @if (data.tables[t.id].length > t.cap) { <p class="muted">The form has room for {{ t.cap }}; extra rows are added to the table and may move the form onto another page.</p> }
            }

            @if (active === 'assets' || active === 'liabilities') {
              <div class="sum">
                <div>Real properties subtotal <strong>{{ peso(tot.real) }}</strong></div>
                <div>Personal properties subtotal <strong>{{ peso(tot.personal) }}</strong></div>
                <div>Total assets <strong>{{ peso(tot.assets) }}</strong></div>
                <div>Total liabilities <strong>{{ peso(tot.liab) }}</strong></div>
                <div>Net worth <strong>{{ peso(tot.net) }}</strong></div>
                <small class="muted">Totals are computed for you and written into the form.</small>
              </div>
            }
            @if (active === 'ids') {
              <p class="muted">The "Subscribed and sworn" part at the bottom is left blank on purpose. The administering officer fills it in.</p>
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
      .sum { margin-top: 1.2rem; padding: .8rem 1rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; display: grid; gap: .25rem; }
    .sum div { display: flex; justify-content: space-between; }
  `],
})
export class SalnEditorComponent {
  svc = inject(SalnEditorService);
  sections = SECTIONS;
  peso = peso;
  active = 'filing';
  data: SalnData | null = null;
  loading = false;
  busy = false;
  error = '';
  msg = '';
  dirty = signal(false);
  private pkg: SalnPackage | null = null;

  constructor() {
    effect(() => {
      const r = this.svc.current();
      this.data = null; this.pkg = null; this.error = ''; this.msg = ''; this.dirty.set(false); this.active = 'filing';
      if (!r) return;
      this.loading = true;
      r.load()
        .then((buf) => openSaln(buf))
        .then((pkg) => {
          this.pkg = pkg;
          const d = readSaln(pkg);
          if (!d.compliance) d.compliance = 'annual';
          if (!d.fields['year']) d.fields['year'] = defaultFilingYear();
          this.data = d;
          this.loading = false;
        })
        .catch((e) => {
          this.loading = false;
          this.error = e instanceof SalnFormatError ? e.message : (e?.message ?? 'Could not open this file.');
        });
    }, { allowSignalWrites: true });
  }

  get tot() { return totals(this.data!); }
  touch() { this.dirty.set(true); this.msg = ''; }
  fieldsOf(section: string) { return FIELDS.filter((f) => f.section === section); }
  tablesOf(section: string) { return TABLES.filter((t) => t.section === section); }

  addRow(t: TableDef) {
    const row: Row = {};
    for (const c of t.cols) row[c.key] = '';
    this.data!.tables[t.id].push(row);
    if (t.id === 'business') this.data!.noBusiness = false;
    if (t.id === 'relatives') this.data!.noRelatives = false;
    this.touch();
  }
  removeRow(t: TableDef, i: number) { this.data!.tables[t.id].splice(i, 1); this.touch(); }

  async download() {
    this.busy = true; this.error = '';
    try {
      const b = await buildSaln(this.pkg!, this.data!);
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
      const b = await buildSaln(this.pkg!, this.data!);
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
