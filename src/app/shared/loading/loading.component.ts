import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

// Drop this in wherever a view is fetching a heavy dataset, instead of a
// generic spinner - per the spec's Branding section ("the TaskEd logo mark
// with a pulsing/rotating ring animation and the wordmark 'TaskEd' fading
// in below it").
@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="loading-brand" [class.compact]="compact">
      <img src="/taskEd-logo.png" alt="TaskEd" class="logo" />
      <div class="track"><div class="runner"></div></div>
      @if (label) {
        <span class="label">{{ label }}</span>
      }
    </div>
  `,
  styles: [
    `
      .loading-brand {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.6rem;
        padding: 2.5rem 1rem;
      }
      .loading-brand.compact {
        padding: 1rem;
      }
      .logo {
        width: 220px;
        max-width: 70%;
        height: auto;
        animation: pulse 1.8s ease-in-out infinite;
      }
      .compact .logo {
        width: 130px;
      }
      .track {
        width: 140px;
        height: 3px;
        border-radius: 3px;
        background: #e5e7eb;
        overflow: hidden;
      }
      .compact .track {
        width: 90px;
      }
      .runner {
        width: 40%;
        height: 100%;
        border-radius: 3px;
        background: #14532d;
        animation: slide 1.1s ease-in-out infinite;
      }
      @keyframes slide {
        0% {
          transform: translateX(-100%);
        }
        100% {
          transform: translateX(250%);
        }
      }
      .label {
        font-size: 0.8rem;
        color: #888;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      @keyframes pulse {
        0%,
        100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.7;
          transform: scale(0.92);
        }
      }
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(4px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `,
  ],
})
export class LoadingComponent {
  @Input() label = '';
  @Input() compact = false;
}
