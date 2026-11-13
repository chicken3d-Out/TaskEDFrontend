import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { blackenPng } from './blacken';
import { TravelAuthorityService } from '../../core/services/travel-authority.service';

const W = 600, H = 220;

// Turns whatever is on the canvas (or an imported picture) into a small transparent PNG:
// white paper becomes see-through and the empty margin is trimmed off.
function toSignaturePng(src: HTMLCanvasElement, removeWhite: boolean): string | null {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const x = c.getContext('2d')!;
  x.drawImage(src, 0, 0);
  const img = x.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
  for (let y = 0; y < c.height; y++) {
    for (let xx = 0; xx < c.width; xx++) {
      const i = (y * c.width + xx) * 4;
      if (removeWhite) {
        const lum = Math.min(d[i], d[i + 1], d[i + 2]);
        // 255 = paper -> transparent; below 150 = ink -> opaque
        const a = lum >= 235 ? 0 : lum <= 150 ? 255 : Math.round(((235 - lum) / 85) * 255);
        d[i + 3] = Math.min(d[i + 3], a);
      }
      if (d[i + 3] > 20) { if (xx < minX) minX = xx; if (xx > maxX) maxX = xx; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
  }
  if (maxX < 0) return null;
  x.putImageData(img, 0, 0);
  const pad = 6;
  const sx = Math.max(0, minX - pad), sy = Math.max(0, minY - pad);
  const sw = Math.min(c.width - sx, maxX - minX + pad * 2), sh = Math.min(c.height - sy, maxY - minY + pad * 2);
  const out = document.createElement('canvas');
  out.width = sw; out.height = sh;
  out.getContext('2d')!.drawImage(c, sx, sy, sw, sh, 0, 0, sw, sh);
  return out.toDataURL('image/png');
}

@Component({
  selector: 'app-signature-pad',
  standalone: true,
  imports: [CommonModule],
  template: `
    <p class="muted">Your signature is used when you sign a Travel Authority. Draw it, or import a picture of it (the white paper is removed and it is saved as a PNG).</p>
    @if (current) {
      <div class="cur"><span>Your saved signature</span><img [src]="current" alt="Your signature" /></div>
    } @else if (loaded) { <p class="muted">No signature saved yet.</p> }

    <div class="tabs2">
      <button type="button" [class.on]="mode === 'draw'" (click)="mode = 'draw'">Draw</button>
      <button type="button" [class.on]="mode === 'import'" (click)="mode = 'import'">Import a picture</button>
    </div>
    <div [hidden]="mode !== 'draw'">
      <canvas #pad [width]="w" [height]="h" class="pad"
        (pointerdown)="down($event)" (pointermove)="move($event)" (pointerup)="up()" (pointerleave)="up()" (pointercancel)="up()"></canvas>
      <div class="row"><button type="button" class="btn secondary" (click)="clear()">Clear</button></div>
    </div>
    @if (mode === 'import') {
      <label class="btn secondary pick">Choose a picture<input type="file" accept="image/*" hidden (change)="pick($event)" /></label>
      <p class="muted">Sign on white paper, take a clear photo or scan, and import it here.</p>
    }
    @if (preview) { <div class="cur"><span>Preview</span><img [src]="preview" alt="Preview" /></div> }
    @if (error) { <p class="error">{{ error }}</p> }
    @if (msg) { <p class="ok">{{ msg }}</p> }
    <div class="row">
      <button type="button" class="btn" (click)="save()" [disabled]="busy">{{ busy ? 'Saving…' : 'Save signature' }}</button>
      @if (current) { <button type="button" class="btn danger" (click)="remove()" [disabled]="busy">Remove</button> }
    </div>
  `,
  styles: [`
    .muted { color: #6b7280; font-size: .85rem; } .ok { color: #166534; } .error { color: #b91c1c; }
    .tabs2 { display: flex; gap: .4rem; margin: .8rem 0 .5rem; }
    .tabs2 button { border: 1px solid #e5e7eb; background: #fff; border-radius: 999px; padding: .35rem .9rem; font: inherit; cursor: pointer; }
    .tabs2 button.on { background: #15803d; color: #fff; border-color: #15803d; }
    .pad { width: 100%; max-width: 600px; aspect-ratio: 600 / 220; border: 1px dashed #9ca3af; border-radius: 10px; background: #fff; touch-action: none; cursor: crosshair; display: block; }
    .row { display: flex; gap: .5rem; margin: .6rem 0; flex-wrap: wrap; }
    .cur { display: flex; flex-direction: column; gap: .3rem; margin: .6rem 0; font-size: .82rem; font-weight: 600; }
    .cur img { max-width: 260px; max-height: 110px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 6px; background: repeating-conic-gradient(#f3f4f6 0 25%, #fff 0 50%) 0 0 / 16px 16px; align-self: flex-start; }
  `],
})
export class SignaturePadComponent implements OnInit {
  private api = inject(TravelAuthorityService);
  @ViewChild('pad') padRef!: ElementRef<HTMLCanvasElement>;
  w = W; h = H;
  mode: 'draw' | 'import' = 'draw';
  current: string | null = null;
  preview: string | null = null;
  loaded = false;
  busy = false;
  error = '';
  msg = '';
  private drawing = false;
  private dirty = false;
  private imported: string | null = null;

  ngOnInit() {
    firstValueFrom(this.api.getSignature()).then((r) => (this.current = r.signature)).catch(() => {}).finally(() => (this.loaded = true));
  }

  private ctx() { const c = this.padRef.nativeElement.getContext('2d')!; c.lineWidth = 3.6; c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#000000'; return c; }
  private pt(e: PointerEvent) { const r = this.padRef.nativeElement.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }; }
  down(e: PointerEvent) { this.drawing = true; this.dirty = true; this.imported = null; this.padRef.nativeElement.setPointerCapture(e.pointerId); const p = this.pt(e); const c = this.ctx(); c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + .01, p.y + .01); c.stroke(); }
  move(e: PointerEvent) { if (!this.drawing) return; const p = this.pt(e); const c = this.ctx(); c.lineTo(p.x, p.y); c.stroke(); }
  up() { if (!this.drawing) return; this.drawing = false; this.refresh(); }
  clear() { this.padRef.nativeElement.getContext('2d')!.clearRect(0, 0, W, H); this.dirty = false; this.preview = null; this.msg = ''; this.error = ''; }

  private refresh() {
    this.preview = toSignaturePng(this.padRef.nativeElement, false);
  }

  pick(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.error = ''; this.msg = '';
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1200 / img.width, 500 / img.height);
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const png = toSignaturePng(c, true);
      if (!png) { this.error = 'Could not find a signature in that picture. Use dark ink on white paper.'; return; }
      this.imported = png; this.preview = png; this.dirty = false;
    };
    img.onerror = () => { URL.revokeObjectURL(url); this.error = 'That file is not a picture.'; };
    img.src = url;
  }

  async save() {
    this.error = ''; this.msg = '';
    const png = this.imported ?? (this.dirty ? toSignaturePng(this.padRef.nativeElement, false) : null);
    if (!png) { this.error = 'Draw your signature or import a picture first.'; return; }
    // keep the file small
    let out = await blackenPng(png);
    if (out.length > 300_000) { this.error = 'That signature is too large. Draw it smaller or use a simpler picture.'; return; }
    this.busy = true;
    try {
      const r = await firstValueFrom(this.api.setSignature(out));
      this.current = r.signature; this.msg = 'Signature saved.'; this.imported = null; this.preview = null; this.clear(); this.msg = 'Signature saved.';
    } catch (e: any) { this.error = e?.error?.message ?? 'Could not save.'; }
    this.busy = false;
  }

  async remove() {
    if (!confirm('Remove your saved signature?')) return;
    this.busy = true;
    try { await firstValueFrom(this.api.setSignature(null)); this.current = null; this.msg = 'Signature removed.'; } catch (e: any) { this.error = e?.error?.message ?? 'Could not remove.'; }
    this.busy = false;
  }
}
