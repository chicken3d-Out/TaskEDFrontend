import { Component, ElementRef, HostListener, ViewChild, effect, inject, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { PdsPreviewService } from './pds-preview.service';
import { renderSalnPreview } from '../saln/saln-preview';
import { PDS_PAGE_CSS, PdsPage, renderPdsPages } from './pds-render';

// A pop-up that shows the Personal Data Sheet exactly as the printed form
// (all pages), read-only. Nothing here can be edited or opened elsewhere.
@Component({
  selector: 'app-pds-preview',
  standalone: true,
  template: `
    @if (svc.current(); as req) {
      <div class="bd" (click)="svc.close()">
        <div class="md" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <div class="hd">
            <strong>{{ req.title }}</strong>
            <span class="sp"></span>
            @if (req.download) { <button class="btn secondary" type="button" (click)="req.download()">Download</button> }
            <button class="btn secondary" type="button" (click)="svc.close()">Close</button>
          </div>
          <div class="bodyx" #host>
            @if (loading()) { <p class="msg">Preparing the preview…</p> }
            @if (error()) { <p class="msg err">{{ error() }}</p> }
            <div #docx class="docxhost"></div>
            @for (p of pages(); track p.title) {
              <div class="label">{{ p.title }}</div>
              <div class="sheet" [style.width.px]="p.width * scale()" [style.height.px]="p.height * scale()">
                <div class="inner" [style.transform]="'scale(' + scale() + ')'" [innerHTML]="html(p)"></div>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .bd{position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:1300;display:flex;align-items:center;justify-content:center;padding:1rem}
    .md{background:var(--surface,#fff);border-radius:14px;width:min(1000px,100%);height:92vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.4)}
    .hd{display:flex;align-items:center;gap:.5rem;padding:.7rem 1rem;border-bottom:1px solid #e2e8f0}
    .sp{flex:1}
    .bodyx{flex:1;overflow:auto;background:#e5e7eb;padding:1rem;display:flex;flex-direction:column;align-items:center;gap:.4rem}
    .label{font-size:.75rem;color:#64748b;align-self:flex-start}
    .sheet{background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.2);margin-bottom:1rem;overflow:hidden;flex:none}
    .docxhost{width:100%;overflow:auto}
    :host ::ng-deep .docx-wrapper{background:transparent!important;padding:0!important}
    :host ::ng-deep .docx-wrapper>section.docx{margin:0 auto 1rem!important;box-shadow:0 2px 10px rgba(0,0,0,.2)}
    .inner{transform-origin:top left}
    .msg{color:#475569}.err{color:#b91c1c}
  `],
})
export class PdsPreviewComponent {
  svc = inject(PdsPreviewService);
  private san = inject(DomSanitizer);
  pages = signal<PdsPage[]>([]);
  loading = signal(false);
  error = signal('');
  scale = signal(1);
  @ViewChild('host') host?: ElementRef<HTMLElement>;
  @ViewChild('docx') docx?: ElementRef<HTMLElement>;
  private css = `<style>${PDS_PAGE_CSS}</style>`;

  constructor() {
    effect(() => {
      const req = this.svc.current();
      this.pages.set([]); this.error.set('');
      if (!req) return;
      this.loading.set(true);
      req.load().then(async (b) => {
        if (req.kind === 'saln') {
          await new Promise((r) => setTimeout(r));
          await renderSalnPreview(b, this.docx!.nativeElement);
          return;
        }
        const p = await renderPdsPages(b);
        this.pages.set(p);
        setTimeout(() => this.fit());
      }).catch((e) => this.error.set(e?.message ?? 'Could not show this file.')).finally(() => this.loading.set(false));
    }, { allowSignalWrites: true });
  }

  html(p: PdsPage): SafeHtml { return this.san.bypassSecurityTrustHtml(this.css + p.html); }

  @HostListener('window:resize') fit() {
    const w = this.host?.nativeElement.clientWidth;
    const max = Math.max(...this.pages().map((p) => p.width), 1);
    if (w) this.scale.set(Math.min(1, (w - 32) / max));
  }
  @HostListener('document:keydown.escape') esc() { this.svc.close(); }
}
