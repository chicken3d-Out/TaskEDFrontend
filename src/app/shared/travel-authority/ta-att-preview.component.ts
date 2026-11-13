import { Component, Injectable, effect, inject, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { TaAttachment, TravelAuthorityService } from '../../core/services/travel-authority.service';

interface Shown { name: string; mime: string; url: string; blob: boolean }

@Injectable({ providedIn: 'root' })
export class TaAttPreviewService {
  private api = inject(TravelAuthorityService);
  readonly shown = signal<Shown | null>(null);
  readonly error = signal('');
  readonly reset = signal(0);

  async open(taId: string, a: TaAttachment) {
    this.error.set('');
    this.reset.update((n) => n + 1);
    try {
      if (a.url) { this.shown.set({ name: a.name, mime: a.mime, url: a.url, blob: false }); return; }
      const got = await firstValueFrom(this.api.getAttachment(taId, a.id));
      if (got.url) { this.shown.set({ name: got.name, mime: got.mime, url: got.url, blob: false }); return; }
      const bin = Uint8Array.from(atob(got.data ?? ''), (c) => c.charCodeAt(0));
      this.shown.set({ name: got.name, mime: got.mime, url: URL.createObjectURL(new Blob([bin], { type: got.mime })), blob: true });
    } catch (e: any) { this.error.set(e?.error?.message ?? 'Could not open the attachment.'); }
  }
  close() { const s = this.shown(); if (s?.blob) URL.revokeObjectURL(s.url); this.shown.set(null); }
}

// Opens an attachment on top of the page (image or PDF), so nobody has to leave the tab.
@Component({
  selector: 'app-ta-att-preview',
  standalone: true,
  template: `
    @if (svc.shown(); as s) {
      <div class="bd" (click)="svc.close()"></div>
      <div class="box" role="dialog" aria-modal="true" [attr.aria-label]="s.name">
        <header><strong>{{ s.name }}</strong><span><a class="btn secondary" [href]="s.url" target="_blank" rel="noopener" [attr.download]="s.name">Open / download</a> <button class="btn" type="button" (click)="svc.close()">Close</button></span></header>
        <div class="view">
          @if (isImage(s)) { <img [src]="s.url" [alt]="s.name" /> }
          @else if (s.blob) { <iframe [src]="safe(s.url)" title="Attachment"></iframe> }
          @else {
            <!-- a PDF is shown page by page as pictures, which Cloudinary always delivers -->
            <div class="pages">
              @for (n of pages(); track n) { <img [src]="pageUrl(s.url, n)" [alt]="'Page ' + n" (load)="more(n)" (error)="failed(n)" /> }
              @if (pdfError()) { <p class="err">This PDF can’t be shown here. In Cloudinary open <strong>Settings › Security</strong> and tick “PDF and ZIP files delivery”, then save. You can still use “Open / download”.</p> }
            </div>
          }
        </div>
      </div>
    }
    @if (svc.error()) { <div class="toast">{{ svc.error() }}</div> }
  `,
  styles: [`
    :host { display: contents; }
    .bd { position: fixed; inset: 0; background: rgba(0,0,0,.6); z-index: 1300; }
    .box { position: fixed; z-index: 1301; inset: 3vh 3vw; background: #fff; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; max-width: 1000px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: center; gap: .6rem; padding: .6rem 1rem; border-bottom: 1px solid #e5e7eb; flex-wrap: wrap; }
    header strong { overflow-wrap: anywhere; } header span { display: flex; gap: .4rem; }
    .view { flex: 1; overflow: auto; background: #f3f4f6; display: flex; justify-content: center; }
    .pages { width: 100%; display: flex; flex-direction: column; align-items: center; gap: .5rem; padding: .5rem; } .err { background: #fff; padding: 1rem; border-radius: 8px; max-width: 34rem; }
    img { max-width: 100%; height: auto; align-self: flex-start; } iframe { width: 100%; height: 100%; border: 0; background: #fff; }
    .toast { position: fixed; z-index: 1302; bottom: 1rem; left: 50%; transform: translateX(-50%); background: #b91c1c; color: #fff; padding: .5rem 1rem; border-radius: 8px; }
  `],
})
export class TaAttPreviewComponent {
  svc = inject(TaAttPreviewService);
  constructor() { effect(() => { this.svc.reset(); this.pages.set([1]); this.pdfError.set(false); this.last = 0; }, { allowSignalWrites: true }); }
  pages = signal<number[]>([1]);
  pdfError = signal(false);
  private last = 0;
  pageUrl(url: string, n: number) { return url.replace('/upload/', `/upload/pg_${n},f_jpg,w_1100/`).replace(/\.pdf(\?.*)?$/i, '.jpg'); }
  more(n: number) { this.last = Math.max(this.last, n); if (n === this.pages().length && n < 15) this.pages.update((p) => [...p, n + 1]); }
  failed(n: number) { // past the last page: stop; the first page failing means PDFs are blocked
    if (n === 1) this.pdfError.set(true);
    else this.pages.update((p) => p.filter((x) => x < n));
  }
  isImage(s: { mime: string; name: string }) { return s.mime.startsWith('image/') || /\.(jpe?g|png)$/i.test(s.name); }
  safe(u: string) { return this.sanitizer.bypassSecurityTrustResourceUrl(u); }
  private sanitizer = inject(DomSanitizer);
}
