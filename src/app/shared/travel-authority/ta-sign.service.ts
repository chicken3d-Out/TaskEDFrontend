import { Injectable, signal } from '@angular/core';

export interface TaSignRequest { id: string }

// Opens the form as pages. When it is the person's turn they tap where the signature goes.
@Injectable({ providedIn: 'root' })
export class TaSignService {
  readonly current = signal<TaSignRequest | null>(null);
  open(id: string) { this.current.set({ id }); }
  close() { this.current.set(null); }
}
