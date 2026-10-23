import { Component } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  template: `
    <div class="login-page">
      <div class="login-card">
        <img src="/sdo-leyte-seal.png" alt="SDO Leyte seal" class="seal" />
        <h1>TaskEd</h1>
        <p>Task &amp; request tracking for the Schools Division of Leyte</p>
        <button class="google-btn" (click)="auth.loginWithGoogle()">
          Sign in with DepEd Google Account
        </button>
        <p class="hint">Only &#64;deped.gov.ph accounts can sign in.</p>
      </div>
    </div>
  `,
  styles: [
    `
      .login-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f3f5f7;
      }
      .login-card {
        background: #fff;
        border-radius: 12px;
        padding: 3rem 2.5rem;
        text-align: center;
        box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
        max-width: 360px;
      }
      .seal {
        width: 72px;
        height: 72px;
        margin-bottom: 1rem;
      }
      h1 {
        margin: 0 0 0.25rem;
        color: #14532d;
      }
      p {
        color: #555;
        margin-bottom: 1.5rem;
      }
      .google-btn {
        width: 100%;
        padding: 0.75rem 1rem;
        border-radius: 8px;
        border: 1px solid #d0d5dd;
        background: #fff;
        font-weight: 600;
        cursor: pointer;
      }
      .google-btn:hover {
        background: #f8f9fa;
      }
      .hint {
        margin-top: 1rem;
        font-size: 0.8rem;
        color: #888;
      }
    `,
  ],
})
export class LoginComponent {
  constructor(public auth: AuthService) {}
}
