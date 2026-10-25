import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AccountStatus } from '../../core/models/user.model';
import { IconComponent } from '../../shared/icon/icon.component';

@Component({
  selector: 'app-pending-approval',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="page">
      <div class="card box">
        <span class="ico"><app-icon [name]="rejected ? 'x' : 'clock'" [size]="30" /></span>
        @if (rejected) {
          <h1>Account not approved</h1>
          <p>
            Your TaskEd account request was not approved. Please contact the Division ICT Unit for details.
          </p>
        } @else {
          <h1>Waiting for approval</h1>
          <p>
            Thanks, {{ auth.currentUser()?.firstName || auth.currentUser()?.name }}. Your profile is in. An
            administrator will review it and assign your role, then you can start using TaskEd.
          </p>
        }
        <div class="actions">
          @if (!rejected) {
            <button class="btn" (click)="check()" [disabled]="checking()">
              {{ checking() ? 'Checking…' : 'Check again' }}
            </button>
          }
          <button class="btn secondary" (click)="auth.logout()">Sign out</button>
        </div>
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
        background: radial-gradient(1000px 500px at 50% -10%, #dcfce7, transparent), var(--bg);
      }
      .box {
        max-width: 440px;
        text-align: center;
        padding: 2.2rem 2rem;
      }
      .ico {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: var(--primary-soft);
        color: var(--primary-strong);
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      h1 {
        font-size: 1.35rem;
        margin: 1rem 0 0.4rem;
      }
      p {
        color: var(--muted);
        margin: 0 0 1.5rem;
      }
      .actions {
        display: flex;
        gap: 0.6rem;
        justify-content: center;
        flex-wrap: wrap;
      }
    `,
  ],
})
export class PendingApprovalComponent {
  checking = signal(false);
  constructor(
    public auth: AuthService,
    private router: Router,
  ) {}

  get rejected() {
    return this.auth.currentUser()?.status === AccountStatus.REJECTED;
  }

  async check() {
    this.checking.set(true);
    await this.auth.loadCurrentUser();
    this.checking.set(false);
    this.router.navigateByUrl(this.auth.routeForCurrentState());
  }
}
