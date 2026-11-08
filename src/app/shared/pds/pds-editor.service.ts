import { Injectable, signal } from '@angular/core';

export interface PdsEditorRequest {
  title: string; // shown at the top, e.g. the file label
  fileName: string; // used when downloading
  load: () => Promise<ArrayBuffer>;
  // Saves the edited file somewhere (e.g. back to the person's Drive). Optional.
  save?: { label: string; run: (blob: Blob, fileName: string) => Promise<string | void> };
}

@Injectable({ providedIn: 'root' })
export class PdsEditorService {
  readonly current = signal<PdsEditorRequest | null>(null);
  open(r: PdsEditorRequest) { this.current.set(r); }
  close() { this.current.set(null); }
}
