import { Injectable, signal } from '@angular/core';
import { TaRecord } from '../../core/services/travel-authority.service';

export interface TaEditorRequest {
  record?: TaRecord; // editing an existing one
  // a new one: who it is for (omit for the signed-in person)
  forTeacher?: { id: string; name: string; position: string; station: string };
}

@Injectable({ providedIn: 'root' })
export class TaEditorService {
  readonly current = signal<TaEditorRequest | null>(null);
  open(r: TaEditorRequest) { this.current.set(r); }
  close() { this.current.set(null); }
}
