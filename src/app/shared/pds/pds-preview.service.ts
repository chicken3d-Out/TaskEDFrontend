import { Injectable, signal } from '@angular/core';

export interface PdsPreviewRequest {
  title: string;
  load: () => Promise<ArrayBuffer>;
  download?: () => Promise<void>;
  kind?: 'xlsx' | 'saln'; // saln = Word document
}

@Injectable({ providedIn: 'root' })
export class PdsPreviewService {
  readonly current = signal<PdsPreviewRequest | null>(null);
  open(r: PdsPreviewRequest) { this.current.set(r); }
  close() { this.current.set(null); }
}
