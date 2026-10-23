import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

// Drop this in wherever a view is fetching a heavy dataset, instead of a
// generic spinner - per the spec's Branding section ("the SDO Leyte seal
// with a pulsing/rotating ring animation and the wordmark 'TaskEd' fading
// in below it").
@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="loading-brand" [class.compact]="compact">
      <div class="ring-wrap">
        <div class="ring"></div>
        <img src="/sdo-leyte-seal.png" alt="" class="seal" />
      </div>
      <span class="wordmark">TaskEd</span>
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
      .ring-wrap {
        position: relative;
        width: 72px;
        height: 72px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .compact .ring-wrap {
        width: 44px;
        height: 44px;
      }
      .ring {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        border: 3px solid #e5e7eb;
        border-top-color: #14532d;
        animation: spin 1s linear infinite;
      }
      .seal {
        width: 60%;
        height: 60%;
        border-radius: 50%;
        animation: pulse 1.6s ease-in-out infinite;
      }
      .wordmark {
        font-weight: 700;
        color: #14532d;
        letter-spacing: 0.02em;
        animation: fadeIn 0.8s ease-in;
      }
      .compact .wordmark {
        font-size: 0.85rem;
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
