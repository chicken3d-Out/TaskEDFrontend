import { Injectable, signal } from '@angular/core';

// Controls the Privacy Policy / Terms of Service modal.
@Injectable({ providedIn: 'root' })
export class LegalService {
  readonly open = signal<'privacy' | 'terms' | null>(null);
  show(kind: 'privacy' | 'terms') {
    this.open.set(kind);
  }
  close() {
    this.open.set(null);
  }
}
