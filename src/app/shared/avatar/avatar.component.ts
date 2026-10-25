import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { initialsOf } from '../../core/models/user.model';

// Round profile picture, falling back to coloured initials.
@Component({
  selector: 'app-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (url) {
      <img [src]="url" alt="" [style.width.px]="size" [style.height.px]="size" />
    } @else {
      <span
        class="initials"
        [style.width.px]="size"
        [style.height.px]="size"
        [style.font-size.px]="size * 0.4"
        >{{ initials }}</span
      >
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        flex: none;
      }
      img {
        border-radius: 50%;
        object-fit: cover;
        display: block;
      }
      .initials {
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, var(--primary), #0f766e);
        color: #fff;
        font-weight: 700;
        letter-spacing: 0.02em;
      }
    `,
  ],
})
export class AvatarComponent {
  @Input() url: string | null | undefined;
  @Input() name: string | null | undefined;
  @Input() size = 36;

  get initials(): string {
    return initialsOf({ name: this.name ?? '' });
  }
}
