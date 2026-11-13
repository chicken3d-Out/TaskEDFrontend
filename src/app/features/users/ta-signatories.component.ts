import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { TravelAuthorityService } from '../../core/services/travel-authority.service';
import { UsersService } from '../../core/services/users.service';
import { User } from '../../core/models/user.model';

interface Part { text: string; userId: string | null; name: string }

// Administrator: who the District Supervisor and the Schools Division Superintendent are for
// Travel Authorities. The account is who signs in TaskEd; the name is what is printed on the form.
@Component({
  selector: 'app-ta-signatories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <details class="card box">
      <summary><strong>Travel Authority signatories</strong> <span class="muted">District Supervisor and Schools Division Superintendent</span></summary>
      <p class="muted">Within Leyte, the Recommending authority is the School Head of the employee's school and the Approving authority is the District Supervisor. Outside the Division, the Recommending authority is the District Supervisor and the Approving authority is the Schools Division Superintendent. Pick the TaskEd account that will sign, and type the name as it should be printed.</p>
      @for (k of keys; track k.id) {
        <div class="grid">
          <strong class="lbl">{{ k.label }}</strong>
          <label>TaskEd account (type a name or email)
            <input [name]="k.id + 'u'" [(ngModel)]="parts[k.id].text" (ngModelChange)="pickUser(k.id)" [attr.list]="'tau-' + k.id" placeholder="Search accounts…" />
            <datalist [id]="'tau-' + k.id">@for (o of options; track o.id) { <option [value]="label(o)"></option> }</datalist>
          </label>
          <label>Name printed on the form
            <input [name]="k.id + 'n'" [(ngModel)]="parts[k.id].name" placeholder="e.g. JUAN D. DELA CRUZ, PhD" />
          </label>
        </div>
      }
      <div class="row"><button class="btn" type="button" (click)="save()" [disabled]="busy">{{ busy ? 'Saving…' : 'Save signatories' }}</button></div>
      @if (msg) { <p class="ok">{{ msg }}</p> }
      @if (error) { <p class="error">{{ error }}</p> }
    </details>
  `,
  styles: [`
    .box { padding: 1rem 1.25rem; margin: 1rem 0; } summary { cursor: pointer; display: flex; gap: .6rem; flex-wrap: wrap; align-items: baseline; }
    .muted { color: #6b7280; font-size: .85rem; } .ok { color: #166534; } .error { color: #b91c1c; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: .5rem .8rem; margin: .8rem 0; } .lbl { grid-column: 1 / -1; }
    label { display: flex; flex-direction: column; gap: .2rem; font-size: .82rem; font-weight: 600; }
    input { padding: .5rem .6rem; border: 1px solid #d1d5db; border-radius: 8px; font: inherit; font-weight: 400; }
    .row { margin-top: .5rem; } @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
  `],
})
export class TaSignatoriesComponent implements OnInit {
  private api = inject(TravelAuthorityService);
  private users = inject(UsersService);
  keys = [{ id: 'ds', label: 'District Supervisor' }, { id: 'sds', label: 'Schools Division Superintendent' }];
  parts: Record<string, Part> = { ds: { text: '', userId: null, name: '' }, sds: { text: '', userId: null, name: '' } };
  options: User[] = [];
  busy = false;
  msg = '';
  error = '';

  label(u: User) { return `${u.name} — ${u.depedEmail ?? u.username ?? ''}`; }

  async ngOnInit() {
    try {
      const [all, s] = await Promise.all([firstValueFrom(this.users.all()), firstValueFrom(this.api.settings())]);
      this.options = all.filter((u) => u.status === 'approved' && ['teacher', 'school_head', 'admin_officer', 'publisher'].includes(u.role ?? ''));
      const fill = (id: string, p: { userId: string | null; userName: string; email: string; name: string }) => {
        this.parts[id] = { userId: p.userId, text: p.userId ? `${p.userName} — ${p.email}` : '', name: p.name };
      };
      fill('ds', s.districtSupervisor); fill('sds', s.sds);
    } catch (e: any) { this.error = e?.error?.message ?? 'Could not load the signatories.'; }
  }

  pickUser(id: string) {
    const p = this.parts[id];
    const u = this.options.find((o) => this.label(o) === p.text);
    if (u) { p.userId = u.id; if (!p.name.trim()) p.name = u.name.toUpperCase(); }
    else if (!p.text.trim()) p.userId = null;
  }

  async save() {
    this.busy = true; this.msg = ''; this.error = '';
    try {
      await firstValueFrom(this.api.saveSettings({
        districtSupervisor: { userId: this.parts['ds'].userId, name: this.parts['ds'].name },
        sds: { userId: this.parts['sds'].userId, name: this.parts['sds'].name },
      }));
      this.msg = 'Saved.';
    } catch (e: any) { this.error = e?.error?.message ?? 'Could not save.'; }
    this.busy = false;
  }
}
