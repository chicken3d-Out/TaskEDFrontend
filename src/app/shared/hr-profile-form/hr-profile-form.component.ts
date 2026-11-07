import { Component, Input, OnChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HrProfile, HrProfileService } from '../../core/services/hr-profile.service';

interface Field { key: string; label: string; hint?: string; type?: 'text' | 'date' | 'number' | 'sex' | 'itemfrom'; list?: string[] }

// Employment details (the DepEd personnel masterlist columns). A Teacher's is
// kept by the AO of the school; everyone else keeps their own.
@Component({
  selector: 'app-hr-profile-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (loading) { <p class="muted">Loading…</p> }
    @else if (error && !data) { <p class="error">{{ error }}</p> }
    @else if (data) {
      <p class="muted note">
        @if (data.canEdit) { These details are private. Only this person, their school's Administrative Officer and the Administrator can see them. }
        @else { These details are kept by your school's Administrative Officer. Ask them to correct anything that is wrong. }
      </p>
      <div class="grid">
        @for (f of fields; track f.key) {
          <label [class.wide]="f.key === 'itemNumber'">
            {{ f.label }}
            @if (f.hint) { <small>{{ f.hint }}</small> }
            @if (f.type === 'sex') {
              <select [name]="f.key" [(ngModel)]="model[f.key]" [disabled]="!data.canEdit">
                <option value="">—</option><option>Male</option><option>Female</option>
              </select>
            } @else if (f.type === 'itemfrom') {
              <select [name]="f.key" [(ngModel)]="model[f.key]" [disabled]="!data.canEdit">
                <option value="">—</option><option>Elementary</option><option>Junior High School</option><option>Senior High School</option>
              </select>
            } @else {
              <input [name]="f.key" [type]="f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'" [(ngModel)]="model[f.key]"
                [disabled]="!data.canEdit" [attr.list]="f.list ? 'dl-' + f.key : null" [placeholder]="f.hint ?? ''" />
              @if (f.list) { <datalist [id]="'dl-' + f.key">@for (o of f.list; track o) { <option [value]="o"></option> }</datalist> }
            }
          </label>
        }
      </div>
      @if (error) { <p class="error">{{ error }}</p> }
      @if (savedMsg) { <p class="ok">{{ savedMsg }}</p> }
      @if (data.canEdit) {
        <button class="btn" type="button" [disabled]="saving" (click)="save()">{{ saving ? 'Saving…' : 'Save details' }}</button>
      }
    }
  `,
  styles: [`
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: .7rem .9rem; margin: .6rem 0 1rem; }
    label { display: flex; flex-direction: column; gap: .2rem; font-size: .85rem; font-weight: 600; }
    label small { font-weight: 400; color: #6b7280; }
    label.wide { grid-column: 1 / -1; }
    input, select { padding: .5rem .6rem; border: 1px solid #d1d5db; border-radius: 8px; font: inherit; font-weight: 400; }
    input:disabled, select:disabled { background: #f3f4f6; color: #374151; }
    .muted { color: #6b7280; font-size: .85rem; } .ok { color: #166534; } .error { color: #b91c1c; }
  `],
})
export class HrProfileFormComponent implements OnChanges {
  private api = inject(HrProfileService);
  @Input() userId = 'me';

  data: HrProfile | null = null;
  model: Record<string, any> = {};
  loading = true;
  saving = false;
  error = '';
  savedMsg = '';

  fields: Field[] = [
    { key: 'schoolIdNo', label: 'School ID' },
    { key: 'schoolName', label: 'School Name' },
    { key: 'itemNumber', label: 'Item Number (refer to your PSIPOP)', hint: 'ex. OSEC-DECSB-TCH1-000000-1998' },
    { key: 'positionTitle', label: 'Position Title' },
    { key: 'salaryGrade', label: 'Salary Grade' },
    { key: 'step', label: 'Step' },
    { key: 'itemFrom', label: 'Item From', type: 'itemfrom' },
    { key: 'employeeNo', label: 'Employee No.' },
    { key: 'nameExtension', label: 'Name Extension', hint: 'Jr., Sr., III' },
    { key: 'sex', label: 'Sex', type: 'sex' },
    { key: 'dateOfBirth', label: 'Date of Birth', type: 'date' },
    { key: 'tin', label: 'T.I.N.', hint: 'ex. 000-111-222' },
    { key: 'originalAppointment', label: 'Original Date of Appointment', type: 'date' },
    { key: 'lastPromotion', label: 'Date of Last Promotion', type: 'date' },
    { key: 'status', label: 'Status', list: ['Permanent', 'Provisional', 'Casual'] },
    { key: 'employmentStatus', label: 'Employment Status', list: ['Original', 'Borrowed'] },
    { key: 'eligibility', label: 'Eligibility', hint: 'ex. LET' },
    { key: 'natureOfWork', label: 'Nature of Work', hint: 'ex. Teaching Services' },
    { key: 'monthlySalary', label: 'Monthly Salary', type: 'number', hint: 'ex. 30000.00' },
    { key: 'sourceOfFund', label: 'Source of Fund', hint: 'ex. MOOE/GMS' },
    { key: 'contractDuration', label: 'Contract Duration', hint: 'ex. 3 months' },
  ];

  ngOnChanges() {
    this.loading = true;
    this.error = '';
    this.savedMsg = '';
    this.api.get(this.userId).subscribe({
      next: (d) => this.apply(d),
      error: (e) => {
        this.error = e?.error?.message ?? 'Could not load the details.';
        this.loading = false;
      },
    });
  }

  private apply(d: HrProfile) {
    this.data = d;
    const m: Record<string, any> = {};
    for (const f of this.fields) m[f.key] = d[f.key] ?? (d.defaults as any)?.[f.key] ?? '';
    this.model = m;
    this.loading = false;
  }

  save() {
    if (!this.data) return;
    this.saving = true;
    this.error = '';
    this.savedMsg = '';
    const dto: Record<string, any> = {};
    for (const f of this.fields) dto[f.key] = this.model[f.key] === '' ? null : this.model[f.key];
    this.api.save(this.data.userId, dto).subscribe({
      next: (d) => {
        this.apply(d);
        this.saving = false;
        this.savedMsg = 'Saved.';
      },
      error: (e) => {
        this.error = e?.error?.message ?? 'Could not save.';
        this.saving = false;
      },
    });
  }
}
