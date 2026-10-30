import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { roleLabel } from '../../core/models/user.model';
import { ProfileFormComponent } from '../../shared/profile-form/profile-form.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ProfileFormComponent, ReactiveFormsModule],
  template: `
    <h1 class="page-title">My profile</h1>
    <div class="card box">
      <div class="meta">
        <span class="badge-pill">{{ roleLabel(auth.currentUser()?.role) }}</span>
        @if (auth.currentUser()?.assignedSchools?.length) {
          <span class="assigned">
            Handles tasks for:
            @for (s of auth.currentUser()?.assignedSchools; track s.id; let last = $last) {
              {{ s.name }}{{ last ? '' : ', ' }}
            }
          </span>
        }
        <small>Your role is assigned by an administrator.</small>
      </div>
      <app-profile-form mode="edit" />
    </div>

    @if (auth.currentUser()?.username) {
      <div class="card box pw">
        <h2>Change password</h2>
        <form [formGroup]="pwForm" (ngSubmit)="changePassword()">
          <label>
            Current password
            <input type="password" formControlName="current" autocomplete="current-password" />
          </label>
          <label>
            New password <small>(at least 10 characters)</small>
            <input type="password" formControlName="next" autocomplete="new-password" />
          </label>
          @if (pwError()) {
            <p class="error">{{ pwError() }}</p>
          }
          @if (pwDone()) {
            <p class="success">Password changed.</p>
          }
          <button class="btn" type="submit" [disabled]="pwForm.invalid || pwBusy()">
            {{ pwBusy() ? 'Saving…' : 'Change password' }}
          </button>
        </form>
      </div>
    }
  `,
  styles: [
    `
      .box {
        max-width: 760px;
        padding: 1.75rem;
      }
      .pw {
        margin-top: 1rem;
        h2 {
          margin: 0 0 1rem;
          font-size: 1.05rem;
        }
        form {
          display: flex;
          flex-direction: column;
          gap: 0.9rem;
          max-width: 360px;
        }
        label {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
          font-size: 0.82rem;
          font-weight: 600;
        }
        small {
          font-weight: 500;
          color: var(--muted);
        }
        .btn {
          align-self: flex-start;
        }
      }
      .meta {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.6rem;
        margin-bottom: 1.25rem;
        font-size: 0.85rem;
      }
      .meta small {
        color: var(--muted);
      }
      .assigned {
        color: #374151;
      }
    `,
  ],
})
export class ProfileComponent {
  public auth = inject(AuthService);
  private fb = inject(FormBuilder);
  roleLabel = roleLabel;

  pwForm = this.fb.group({
    current: ['', Validators.required],
    next: ['', [Validators.required, Validators.minLength(10)]],
  });
  pwBusy = signal(false);
  pwError = signal<string | null>(null);
  pwDone = signal(false);

  async changePassword() {
    if (this.pwForm.invalid) return;
    this.pwBusy.set(true);
    this.pwError.set(null);
    this.pwDone.set(false);
    try {
      await this.auth.changePassword(this.pwForm.value.current!, this.pwForm.value.next!);
      this.pwForm.reset();
      this.pwDone.set(true);
    } catch (e: any) {
      this.pwError.set(e?.error?.message ?? 'Could not change the password.');
    } finally {
      this.pwBusy.set(false);
    }
  }
}
