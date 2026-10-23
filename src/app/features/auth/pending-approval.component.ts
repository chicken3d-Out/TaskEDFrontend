import { Component } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { AccountStatus } from '../../core/models/user.model';

@Component({
  selector: 'app-pending-approval',
  standalone: true,
  template: `
    <div class="pending-page">
      <div class="card">
        @if (auth.currentUser()?.status === Status.REJECTED) {
          <h1>Account not approved</h1>
          <p>
            Your TaskEd account request was not approved. Please contact your
            Administrative Officer or the Division ICT Unit for details.
          </p>
        } @else {
          <h1>Waiting for approval</h1>
          <p>
            Thanks, {{ auth.currentUser()?.name }} — your registration is in.
            @if (auth.currentUser()?.role === 'teacher') {
              Your school's Administrative Officer needs to approve your account
              before you can file tickets.
            } @else {
              A Division Administrator needs to approve your account before you
              can sign in.
            }
          </p>
        }
        <button (click)="auth.logout()">Sign out</button>
      </div>
    </div>
  `,
  styles: [
    `
      .pending-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f3f5f7;
      }
      .card {
        background: #fff;
        border-radius: 12px;
        padding: 2.5rem;
        max-width: 420px;
        text-align: center;
        box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
      }
      h1 {
        color: #14532d;
        font-size: 1.3rem;
      }
      p {
        color: #555;
        line-height: 1.5;
        margin-bottom: 1.5rem;
      }
      button {
        padding: 0.6rem 1.5rem;
        border-radius: 8px;
        border: 1px solid #d0d5dd;
        background: #fff;
        cursor: pointer;
      }
    `,
  ],
})
export class PendingApprovalComponent {
  Status = AccountStatus;
  constructor(public auth: AuthService) {}
}
