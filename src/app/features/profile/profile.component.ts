import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { roleLabel } from '../../core/models/user.model';
import { ProfileFormComponent } from '../../shared/profile-form/profile-form.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ProfileFormComponent],
  template: `
    <h1 class="page-title">My profile</h1>
    <div class="card box">
      <div class="meta">
        <span class="badge-pill">{{ roleLabel(auth.currentUser()?.role) }}</span>
        @if (auth.currentUser()?.assignedSchools?.length) {
          <span class="assigned">
            Handles tickets for:
            @for (s of auth.currentUser()?.assignedSchools; track s.id; let last = $last) {
              {{ s.name }}{{ last ? '' : ', ' }}
            }
          </span>
        }
        <small>Your role is assigned by an administrator.</small>
      </div>
      <app-profile-form mode="edit" />
    </div>
  `,
  styles: [
    `
      .box {
        max-width: 760px;
        padding: 1.75rem;
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
  roleLabel = roleLabel;
}
