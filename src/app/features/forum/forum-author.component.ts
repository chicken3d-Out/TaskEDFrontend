import { Component, Input } from '@angular/core';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { PublicProfile } from '../../core/models/forum.model';

// The mini profile shown with every question and reply.
@Component({
  selector: 'app-forum-author',
  standalone: true,
  imports: [AvatarComponent],
  template: `
    <div class="author">
      <app-avatar [url]="profile?.avatarUrl" [name]="profile?.name" [size]="size" />
      <div class="who">
        <strong>{{ profile?.name }}</strong>
        <small>
          {{ profile?.designation || 'Administrative Officer' }}
          @if (profile?.school) { · {{ profile?.school }} }
        </small>
        @if (profile?.district) {
          <small>{{ profile?.district }}{{ profile?.area ? ' · Area ' + profile?.area : '' }}</small>
        }
      </div>
    </div>
  `,
  styles: [`
    .author { display: flex; gap: 0.6rem; align-items: center; min-width: 0; }
    .who { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; }
    strong { font-size: 0.9rem; }
    small { color: var(--muted); font-size: 0.75rem; overflow-wrap: anywhere; }
  `],
})
export class ForumAuthorComponent {
  @Input() profile: PublicProfile | null = null;
  @Input() size = 38;
}
