import { Component } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  template: `
    <div class="page">
      <div class="card box">
        <img src="/sdo-leyte-seal.png" alt="SDO Leyte seal" class="seal" />
        <h1>Task<b>Ed</b></h1>
        <p class="tag">Task and request tracking for the Schools Division of Leyte</p>
        <button class="google" (click)="auth.loginWithGoogle()">
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.2 5.6c4.3-3.9 7.1-9.7 7.1-17.1z"/>
            <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/>
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.2-5.6c-2 1.4-4.6 2.3-8.7 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
          </svg>
          Sign in with DepEd Google account
        </button>
        <p class="hint">Only &#64;deped.gov.ph accounts can sign in.</p>
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
        padding: 2.6rem 2.2rem;
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
        margin: 0 0 1.6rem;
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
    `,
  ],
})
export class LoginComponent {
  constructor(public auth: AuthService) {}
}
