import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { IconComponent } from '../../shared/icon/icon.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, IconComponent],
  template: `
    <div class="page">
      <div class="card box">
        <img src="/sdo-leyte-seal.png" alt="SDO Leyte seal" class="seal" />
        <h1>Task<b>Ed</b></h1>
        <p class="tag">Task and request tracking for the Schools Division of Leyte</p>

        <div class="tabs" role="tablist">
          <button role="tab" [class.on]="tab() === 'staff'" (click)="tab.set('staff')">DepEd account</button>
          <button role="tab" [class.on]="tab() === 'admin'" (click)="tab.set('admin')">Administrator</button>
        </div>

        @if (notice()) {
          <p class="notice">{{ notice() }}</p>
        }

        @if (tab() === 'staff') {
          <button class="google" (click)="auth.loginWithGoogle()">
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.2 5.6c4.3-3.9 7.1-9.7 7.1-17.1z"/>
              <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/>
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.2-5.6c-2 1.4-4.6 2.3-8.7 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
            </svg>
            Sign in with DepEd Google account
          </button>
          <p class="hint">For teachers and administrative staff. Only &#64;deped.gov.ph accounts can sign in.</p>
        } @else {
          <form [formGroup]="form" (ngSubmit)="submit()" class="admin-form">
            <label>
              Username
              <input formControlName="username" autocomplete="username" />
            </label>
            <label>
              Password
              <input type="password" formControlName="password" autocomplete="current-password" />
            </label>
            @if (error()) {
              <p class="error">{{ error() }}</p>
            }
            <button class="btn" type="submit" [disabled]="form.invalid || busy()">
              <app-icon name="shield" [size]="18" />
              {{ busy() ? 'Signing in…' : 'Sign in as administrator' }}
            </button>
          </form>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        background: radial-gradient(1100px 600px at 50% -10%, #bbf7d0, transparent),
          radial-gradient(800px 500px at 100% 110%, #dbeafe, transparent), var(--bg);
      }
      .box {
        max-width: 400px;
        width: 100%;
        text-align: center;
        padding: 2.4rem 2.2rem;
      }
      .seal {
        width: 84px;
        height: 84px;
      }
      h1 {
        margin: 0.7rem 0 0.2rem;
        font-size: 2rem;
        b {
          color: var(--primary);
        }
      }
      .tag {
        color: var(--muted);
        margin: 0 0 1.4rem;
      }
      .tabs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        background: #e8ecf0;
        padding: 3px;
        border-radius: 12px;
        margin-bottom: 1.3rem;
        button {
          border: none;
          background: transparent;
          padding: 0.5rem;
          border-radius: 9px;
          font-weight: 600;
          font-size: 0.88rem;
          color: #374151;
          &.on {
            background: #fff;
            box-shadow: var(--shadow);
            color: var(--primary-strong);
          }
        }
      }
      .notice {
        background: #fffbeb;
        border: 1px solid #fde68a;
        color: #92400e;
        border-radius: 10px;
        padding: 0.6rem 0.8rem;
        font-size: 0.85rem;
        margin: 0 0 1rem;
        text-align: left;
      }
      .google {
        width: 100%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.7rem;
        padding: 0.8rem 1rem;
        border-radius: 12px;
        border: 1px solid var(--border);
        background: #fff;
        font-weight: 600;
        box-shadow: var(--shadow);
        &:hover {
          background: var(--surface-2);
        }
      }
      .hint {
        margin: 1rem 0 0;
        font-size: 0.8rem;
        color: var(--muted);
      }
      .admin-form {
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
        text-align: left;
        label {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
          font-size: 0.82rem;
          font-weight: 600;
        }
        .error {
          margin: 0;
        }
      }
    `,
  ],
})
export class LoginComponent implements OnInit {
  public auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);

  tab = signal<'staff' | 'admin'>('staff');
  busy = signal(false);
  error = signal<string | null>(null);
  notice = signal<string | null>(null);

  form = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  ngOnInit() {
    if (this.route.snapshot.queryParamMap.get('error') === 'admin_use_password') {
      this.tab.set('admin');
      this.notice.set('That account is an Administrator. Please sign in with your username and password.');
    }
  }

  async submit() {
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.adminLogin(this.form.value.username!, this.form.value.password!);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'Could not sign in. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }
}
