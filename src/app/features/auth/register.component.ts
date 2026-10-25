import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ProfileFormComponent } from '../../shared/profile-form/profile-form.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ProfileFormComponent],
  template: `
    <div class="page">
      <div class="card box">
        <div class="head">
          <img src="/sdo-leyte-seal.png" alt="" />
          <div>
            <h1>Set up your TaskEd profile</h1>
            <p>
              Signed in as <b>{{ auth.currentUser()?.depedEmail }}</b
              >. An administrator will review it and assign your role.
            </p>
          </div>
        </div>
        <app-profile-form mode="register" (saved)="done()" />
        <button class="link" (click)="auth.logout()">Sign out</button>
      </div>
    </div>
  `,
  styles: [
    `
      .page {
        min-height: 100vh;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 2rem 1rem;
        background: radial-gradient(1200px 500px at 50% -10%, #dcfce7, transparent), var(--bg);
      }
      .box {
        width: 100%;
        max-width: 720px;
        padding: 1.75rem;
      }
      .head {
        display: flex;
        gap: 1rem;
        align-items: center;
        margin-bottom: 1.5rem;
      }
      .head img {
        width: 56px;
        height: 56px;
      }
      h1 {
        margin: 0;
        font-size: 1.35rem;
      }
      p {
        margin: 0.2rem 0 0;
        color: var(--muted);
        font-size: 0.9rem;
      }
      .link {
        margin-top: 1rem;
        border: none;
        background: none;
        color: var(--muted);
        text-decoration: underline;
      }
    `,
  ],
})
export class RegisterComponent {
  public auth = inject(AuthService);
  private router = inject(Router);

  done() {
    this.router.navigateByUrl(this.auth.routeForCurrentState());
  }
}
