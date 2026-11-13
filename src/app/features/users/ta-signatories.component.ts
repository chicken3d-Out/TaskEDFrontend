import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { TravelAuthorityService } from '../../core/services/travel-authority.service';
import { UsersService } from '../../core/services/users.service';
import { User } from '../../core/models/user.model';
import { SignaturePadComponent } from '../../shared/signature/signature-pad.component';

interface Part { text: string; userId: string | null; name: string }

// Administrator: who the District Supervisor and the Schools Division Superintendent are for
// Travel Authorities. The account is who signs in TaskEd; the name is what is printed on the form.
@Component({
  selector: 'app-ta-signatories',
  standalone: true,
  imports: [CommonModule, FormsModule, SignaturePadComponent],
  template: `
    <details class="card box">
      <summary><strong>Travel Authority signatories</strong> <span class="muted">District Supervisor, Superintendent, CID Chief, Assistant Superintendent</span></summary>
      <p class="muted">Teacher, AO, Publisher and DS Secretary: within Leyte the School Head recommends and the District Supervisor approves; outside the Division the School Head countersigns, the District Supervisor recommends and the Superintendent approves (by email). School Head: within Leyte only the District Supervisor approves; outside, the District Supervisor recommends and the Superintendent approves (by email). District Supervisor: within Leyte the CID Chief recommends and the Assistant Superintendent approves; outside, the Assistant Superintendent recommends and the Superintendent approves (all by email, nobody e-signs). Pick the District Supervisor's TaskEd account (a District Supervisor account), and type the names as they should be printed. The DS Secretary signs for the District Supervisor with the signature uploaded below.</p>
      @for (k of keys; track k.id) {
        <div class="grid">
          <strong class="lbl">{{ k.label }}</strong>
          @if (k.account) {
            <label>TaskEd account (type a name or email)
              <input [name]="k.id + 'u'" [(ngModel)]="parts[k.id].text" (ngModelChange)="pickUser(k.id)" [attr.list]="'tau-' + k.id" placeholder="Search accounts…" />
              <datalist [id]="'tau-' + k.id">@for (o of options; track o.id) { <option [value]="label(o)"></option> }</datalist>
            </label>
          } @else { <p class="muted lbl">Not an account: this person does not e-sign. The signed form is emailed to travel.authority&#64;deped.gov.ph.</p> }
          <label>Name printed on the form
            <input [name]="k.id + 'n'" [(ngModel)]="parts[k.id].name" placeholder="e.g. JUAN D. DELA CRUZ, PhD" />
          </label>
        </div>
      }
      <div class="row"><button class="btn" type="button" (click)="save()" [disabled]="busy">{{ busy ? 'Saving…' : 'Save signatories' }}</button></div>
      <h4>District Supervisor's signature</h4>
      <app-signature-pad [intro]="dsIntro" [loader]="loadDsSig" [saver]="saveDsSig" />
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
    h4 { margin: 1.2rem 0 .2rem; } .row { margin-top: .5rem; } @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
  `],
})
export class TaSignatoriesComponent implements OnInit {
  private api = inject(TravelAuthorityService);
  private users = inject(UsersService);
  keys = [{ id: 'ds', label: 'District Supervisor', account: true }, { id: 'sds', label: 'Schools Division Superintendent', account: false }, { id: 'cid', label: 'CID Chief (recommends a District Supervisor’s travel within the Division)', account: false }, { id: 'asds', label: 'Assistant Schools Division Superintendent (approves a District Supervisor’s travel within the Division; recommends it outside)', account: false }];
  parts: Record<string, Part> = { ds: { text: '', userId: null, name: '' }, sds: { text: '', userId: null, name: '' }, cid: { text: '', userId: null, name: '' }, asds: { text: '', userId: null, name: '' } };
  options: User[] = [];
  busy = false;
  msg = '';
  error = '';

  dsIntro = 'Upload the District Supervisor’s signature (draw it or import a picture). The DS Secretary uses it to sign Travel Authorities on the District Supervisor’s behalf. Save the signatories above first.';
  loadDsSig = async () => (await firstValueFrom(this.api.settings())).districtSupervisor.signature ?? null;
  saveDsSig = async (png: string | null) => {
    const s = await firstValueFrom(this.api.saveSettings({ districtSupervisor: { userId: this.parts['ds'].userId, name: this.parts['ds'].name, signature: png }, sds: { userId: this.parts['sds'].userId, name: this.parts['sds'].name }, cidChief: { name: this.parts['cid'].name }, asds: { name: this.parts['asds'].name } }));
    return s.districtSupervisor.signature ?? null;
  };

  label(u: User) { return `${u.name} — ${u.depedEmail ?? u.username ?? ''}`; }

  async ngOnInit() {
    try {
      const [all, s] = await Promise.all([firstValueFrom(this.users.all()), firstValueFrom(this.api.settings())]);
      this.options = all.filter((u) => u.status === 'approved' && ['teacher', 'school_head', 'admin_officer', 'publisher', 'district_supervisor', 'ds_secretary'].includes(u.role ?? ''));
      const fill = (id: string, p: { userId: string | null; userName: string; email: string; name: string }) => {
        this.parts[id] = { userId: p.userId, text: p.userId ? `${p.userName} — ${p.email}` : '', name: p.name };
      };
      fill('ds', s.districtSupervisor); fill('sds', s.sds); fill('cid', s.cidChief); fill('asds', s.asds);
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
        cidChief: { name: this.parts['cid'].name },
        asds: { name: this.parts['asds'].name },
      }));
      this.msg = 'Saved.';
    } catch (e: any) { this.error = e?.error?.message ?? 'Could not save.'; }
    this.busy = false;
  }
}
