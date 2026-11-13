import { Injectable, signal } from '@angular/core';

import { TaRecord } from '../../core/services/travel-authority.service';

export interface TaSignRequest { id: string; draft?: TaRecord }

// Opens the form as pages. When it is the person's turn they tap where the signature goes.
@Injectable({ providedIn: 'root' })
export class TaSignService {
  readonly current = signal<TaSignRequest | null>(null);
  open(id: string) { this.current.set({ id }); }
  // a look at the form as typed so far (not saved yet)
  preview(draft: TaRecord) { this.current.set({ id: '', draft }); }
  close() { this.current.set(null); }
}
