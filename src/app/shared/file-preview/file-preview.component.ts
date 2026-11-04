import { Component, HostListener, computed, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { FilePreviewService } from './file-preview.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-file-preview',
  standalone: true,
  imports: [IconComponent],
  template: `
    @if (preview.state(); as s) {
      <div class="backdrop" (click)="preview.close()">
        <div class="dialog" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <div class="bar">
            <strong class="title">{{ s.name }}</strong>
            <a class="btn secondary" [href]="s.link" target="_blank" rel="noopener noreferrer">Open in new tab</a>
            <button type="button" class="x" (click)="preview.close()" aria-label="Close"><app-icon name="x" [size]="20" /></button>
          </div>
          <div class="body">
            @if (safe(); as src) {
              <iframe [src]="src" title="Document preview" loading="lazy" referrerpolicy="no-referrer"></iframe>
            } @else {
              <div class="nopreview">
                <p>This kind of link (a folder, OneDrive or SharePoint) cannot be previewed inside TaskEd.</p>
                <a class="btn" [href]="s.link" target="_blank" rel="noopener noreferrer">Open it in a new tab</a>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.6); z-index: 1100; display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .dialog { background: var(--surface, #fff); border-radius: 16px; width: min(1000px, 100%); height: min(88vh, 800px); display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,.35); overflow: hidden; }
    .bar { display: flex; align-items: center; gap: .6rem; padding: .6rem .9rem; border-bottom: 1px solid var(--border); }
    .title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .x { border: none; background: transparent; cursor: pointer; padding: .3rem; border-radius: 8px; color: var(--muted); }
    .body { flex: 1; min-height: 0; }
    iframe { width: 100%; height: 100%; border: 0; }
    .nopreview { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; text-align: center; padding: 1.5rem; color: var(--muted); }
  `],
})
export class FilePreviewComponent {
  preview = inject(FilePreviewService);
  private sanitizer = inject(DomSanitizer);
  safe = computed(() => {
    const e = this.preview.state()?.embed;
    return e ? this.sanitizer.bypassSecurityTrustResourceUrl(e) : null;
  });
  @HostListener('document:keydown.escape') onEsc() {
    this.preview.close();
  }
}
