import { Injectable, signal } from '@angular/core';
import { PdsEditorRequest } from '../pds/pds-editor.service';

@Injectable({ providedIn: 'root' })
export class SrEditorService {
  readonly current = signal<PdsEditorRequest | null>(null);
  open(r: PdsEditorRequest) { this.current.set(r); }
  close() { this.current.set(null); }
}
