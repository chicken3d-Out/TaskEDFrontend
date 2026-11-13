import { TaRecord } from '../../core/services/travel-authority.service';
import { blackenPng } from '../signature/blacken';
import { renderSalnPreview } from '../saln/saln-preview';
import { TaPackage, buildTa, emptyTa, pageSizeIn, pngSizeOf, sigSizeIn } from './ta-engine';

export function taData(rec: TaRecord) {
  return { ...emptyTa(), name: rec.data.name, position: rec.data.position, station: rec.data.station, purpose: rec.data.purpose, host: rec.data.host, dates: rec.data.dates, destination: rec.data.destination, fund: rec.data.fund, recommending: rec.recommendingName, approving: rec.approvingName };
}

// The form, typed in and laid out exactly once, as a picture of the page. Signatures are NOT on it yet:
// the page is fixed first, then people tap on it to place their signature, so nothing can shift.
export async function renderBasePage(rec: TaRecord, pkg: TaPackage): Promise<HTMLCanvasElement> {
  const docx = await buildTa(pkg, taData(rec), rec.sigs, false); // dates are printed, signature pictures are not
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;background:#fff';
  document.body.appendChild(host);
  try {
    await renderSalnPreview(await docx.arrayBuffer(), host);
    const page = host.querySelector('section.docx') as HTMLElement | null;
    if (!page) throw new Error('Could not lay out the form.');
    const html2canvas = (await import('html2canvas')).default;
    return await html2canvas(page, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
  } finally { host.remove(); }
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('bad image')); i.src = src; });
}

// One-page PDF of the page picture with the signatures placed on it.
export async function buildPdf(rec: TaRecord, pkg: TaPackage, base?: HTMLCanvasElement): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const b = base ?? (await renderBasePage(rec, pkg));
  canvas.width = b.width; canvas.height = b.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(b, 0, 0);
  const size = pageSizeIn(pkg);
  for (const s of [rec.sigs?.requester, rec.sigs?.countersign, rec.sigs?.recommending, rec.sigs?.approving]) {
    if (!s) continue;
    const url = await blackenPng(s.img);
    const px = pngSizeOf(s.img), box = sigSizeIn(px.w, px.h);
    const w = (box.w / size.w) * canvas.width, h = w * (px.h / px.w);
    ctx.drawImage(await loadImg(url), s.x * canvas.width - w / 2, s.y * canvas.height - h / 2, w, h);
  }
  const jpeg = Uint8Array.from(atob(canvas.toDataURL('image/jpeg', 0.93).split(',')[1]), (c) => c.charCodeAt(0));
  return pdfFromJpeg(jpeg, canvas.width, canvas.height, size.w * 72, size.h * 72);
}

function pdfFromJpeg(jpeg: Uint8Array, w: number, h: number, wPt: number, hPt: number): Blob {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let len = 0;
  const offs: number[] = [];
  const push = (u: Uint8Array | string) => { const x = typeof u === 'string' ? enc.encode(u) : u; chunks.push(x); len += x.length; };
  const W = wPt.toFixed(2), H = hPt.toFixed(2);
  push('%PDF-1.4\n');
  offs[1] = len; push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  offs[2] = len; push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  offs[3] = len; push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`);
  offs[4] = len; push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`); push(jpeg); push('\nendstream\nendobj\n');
  const content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
  offs[5] = len; push(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
  const x = len;
  push('xref\n0 6\n0000000000 65535 f \n');
  for (let i = 1; i <= 5; i++) push(`${String(offs[i]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`);
  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}
