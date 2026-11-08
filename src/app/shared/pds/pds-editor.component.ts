import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PdsEditorService } from './pds-editor.service';
import { PdsData, PdsFormatError, PdsPackage, Row, buildPds, openPds, readPds } from './pds-engine';
import { FIELDS, QUESTIONS, RADIOS, SECTIONS, TABLES, TableDef } from './pds-schema';

@Component({
  selector: 'app-pds-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (svc.current(); as req) {
      <div class="backdrop" (click)="tryClose()"></div>
      <div class="panel" role="dialog" aria-modal="true" aria-label="Personal Data Sheet editor">
        <header>
          <div>
            <h2>Personal Data Sheet</h2>
            <small>{{ req.title }} · CS Form 212 (Revised 2026)</small>
          </div>
          <div class="hbtns">
            @if (data) {
              <button class="btn secondary" type="button" (click)="download()" [disabled]="busy">Download .xlsx</button>
              @if (req.save && !req.readOnly) { <button class="btn" type="button" (click)="save()" [disabled]="busy">{{ busy ? 'Saving…' : req.save.label }}</button> }
            }
            <button class="btn secondary" type="button" (click)="tryClose()">Close</button>
          </div>
        </header>

        @if (loading) { <p class="muted pad">Reading your file…</p> }
        @if (error) { <p class="error pad">{{ error }}</p> }
        @if (msg) { <p class="ok pad">{{ msg }}</p> }

        @if (data) {
          <nav class="chips">
            @for (s of sections; track s.id) {
              <button type="button" [class.on]="active === s.id" (click)="active = s.id">{{ s.title }}</button>
            }
          </nav>
          @if (dirty()) { <p class="muted pad">You have unsaved changes. Save or download to keep them.</p> }

          @if (req.readOnly) { <p class="muted pad">Preview only. Press Edit on the file to make changes.</p> }
          <div class="body"><fieldset class="ro" [disabled]="!!req.readOnly">
            <!-- single fields grouped -->
            @for (g of groupsOf(active); track g.name) {
              @if (g.name) { <h3>{{ g.name }}</h3> }
              <div class="grid">
                @for (f of g.fields; track f.id) {
                  <label>{{ f.label }}<input [name]="f.id" [(ngModel)]="data.fields[f.id]" (ngModelChange)="touch()" /></label>
                }
              </div>
            }

            @for (r of radiosOf(active); track r.id) {
              <h3>{{ r.label }}</h3>
              <div class="opts">
                @for (o of r.options; track o.value) {
                  <label class="opt"><input type="radio" [name]="r.id" [value]="o.value" [(ngModel)]="data.radios[r.id]" (ngModelChange)="touch()" /> {{ o.label }}</label>
                }
                <label class="opt clear"><input type="radio" [name]="r.id" value="" [(ngModel)]="data.radios[r.id]" (ngModelChange)="touch()" /> None</label>
              </div>
            }
            @if (active === 'personal' && data.radios['citizenship'] === 'Dual') {
              <h3>Dual citizenship – country</h3>
              <select name="country" [(ngModel)]="data.country" (ngModelChange)="touch()">
                <option value="">—</option>
                @for (c of countries; track c) { <option>{{ c }}</option> }
              </select>
            }

            @for (t of tablesOf(active); track t.id) {
              <h3>{{ t.title }} <small class="muted">({{ data.tables[t.id].length }}/{{ capacity(t) }})</small></h3>
              @if (t.note) { <p class="muted">{{ t.note }}</p> }
              @for (row of data.tables[t.id]; track $index; let i = $index) {
                <div class="entry">
                  <div class="ehead">
                    <strong>{{ t.fixedLabels ? t.fixedLabels[i] : (t.rowLabel | titlecase) + ' ' + (i + 1) }}</strong>
                    @if (!t.fixedLabels && !req.readOnly) { <button type="button" class="link danger" (click)="removeRow(t, i)">Remove</button> }
                  </div>
                  <div class="grid">
                    @for (c of t.cols; track c.key) {
                      <label [class.wide]="c.wide">{{ c.label }}<input [name]="t.id + i + c.key" [(ngModel)]="row[c.key]" (ngModelChange)="touch()" /></label>
                    }
                  </div>
                </div>
              }
              @if (!t.fixedLabels && !req.readOnly) {
                <button type="button" class="btn secondary" [disabled]="data.tables[t.id].length >= capacity(t)" (click)="addRow(t)">+ Add {{ t.rowLabel }}</button>
                @if (data.tables[t.id].length >= capacity(t)) { <p class="muted">The form is full. More rows need a continuation sheet, which TaskEd cannot write yet.</p> }
              }
            }

            @if (active === 'questions') {
              @for (q of questions; track q.id) {
                <div class="q">
                  <p><strong>{{ q.num }}.</strong> {{ q.text }}</p>
                  <div class="opts">
                    <label class="opt"><input type="radio" [name]="q.id" value="yes" [(ngModel)]="data.questions[q.id].answer" (ngModelChange)="touch()" /> Yes</label>
                    <label class="opt"><input type="radio" [name]="q.id" value="no" [(ngModel)]="data.questions[q.id].answer" (ngModelChange)="touch()" /> No</label>
                    <label class="opt clear"><input type="radio" [name]="q.id" value="" [(ngModel)]="data.questions[q.id].answer" (ngModelChange)="touch()" /> Not answered</label>
                  </div>
                  @if (data.questions[q.id].answer === 'yes') {
                    <label>Details<input [name]="q.id + 'd'" [(ngModel)]="data.questions[q.id].details" (ngModelChange)="touch()" /></label>
                    @for (e of q.extra ?? []; track e.key) {
                      <label>{{ e.label }}<input [name]="q.id + e.key" [(ngModel)]="data.questions[q.id].extra[e.key]" (ngModelChange)="touch()" /></label>
                    }
                  }
                </div>
              }
            }
          </fieldset></div>
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
  `],
})
export class PdsEditorComponent {
  svc = inject(PdsEditorService);
  sections = SECTIONS;
  questions = QUESTIONS;
  active = 'personal';
  data: PdsData | null = null;
  loading = false;
  busy = false;
  error = '';
  msg = '';
  dirty = signal(false);
  countries: string[] = [];
  private pkg: PdsPackage | null = null;

  constructor() {
    effect(() => {
      const r = this.svc.current();
      this.data = null; this.pkg = null; this.error = ''; this.msg = ''; this.dirty.set(false); this.active = 'personal';
      if (!r) return;
      this.loading = true;
      r.load()
        .then((buf) => openPds(buf))
        .then((pkg) => {
          this.pkg = pkg;
          this.data = readPds(pkg);
          this.countries = pkg.countries.slice(1).filter(Boolean);
          this.loading = false;
        })
        .catch((e) => {
          this.loading = false;
          this.error = e instanceof PdsFormatError ? e.message : (e?.message ?? 'Could not open this file.');
        });
    }, { allowSignalWrites: true });
  }

  touch() { this.dirty.set(true); this.msg = ''; }

  groupsOf(section: string) {
    const out: { name: string; fields: typeof FIELDS }[] = [];
    for (const f of FIELDS.filter((x) => x.section === section)) {
      const name = f.group ?? '';
      let g = out.find((x) => x.name === name);
      if (!g) { g = { name, fields: [] }; out.push(g); }
      g.fields.push(f);
    }
    return out;
  }
  radiosOf(section: string) { return RADIOS.filter((r) => r.section === section); }
  tablesOf(section: string) { return TABLES.filter((t) => t.section === section); }
  capacity(t: TableDef) { return t.last - t.first + 1; }

  addRow(t: TableDef) {
    const row: Row = {};
    for (const c of t.cols) row[c.key] = '';
    this.data!.tables[t.id].push(row);
    this.touch();
  }
  removeRow(t: TableDef, i: number) { this.data!.tables[t.id].splice(i, 1); this.touch(); }

  private async blob(): Promise<Blob> {
    const b = await buildPds(this.pkg!, this.data!);
    const warn: string[] = (b as any).warnings ?? [];
    if (warn.length) this.msg = warn.join(' ');
    return b;
  }

  async download() {
    this.busy = true; this.error = '';
    try {
      const b = await this.blob();
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
      const b = await this.blob();
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
