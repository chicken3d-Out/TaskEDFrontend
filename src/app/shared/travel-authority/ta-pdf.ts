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
  // justified lines get letter gaps ("aut horized") when drawn to a picture: keep those lines left-aligned
  const fix = document.createElement('style');
  fix.textContent = 'section.docx p[style*="justify"]{text-align:left !important;text-justify:none !important;letter-spacing:normal !important;word-spacing:normal !important}';
  host.appendChild(fix);
  document.body.appendChild(host);
  try {
    await renderSalnPreview(await docx.arrayBuffer(), host);
    const page = host.querySelector('section.docx') as HTMLElement | null;
    if (!page) throw new Error('Could not lay out the form.');
    alignTabs(page);
    // the on-screen footer lays its pictures out wrongly; it is drawn again from the template below
    page.querySelectorAll('footer').forEach((el) => ((el as HTMLElement).style.visibility = 'hidden'));
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(page, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
    await drawHeaderFooter(canvas, rec.taNumber ?? '', pkg);
    return canvas;
  } finally { host.remove(); }
}

// The on-screen layout turns a tab into one space. In the signature blocks the Word form has a centre
// tab stop 6870 twips (343.5 pt) in, which centres the date over its line and the word "Date" under
// it: put that back.
function alignTabs(page: HTMLElement) {
  for (const p of Array.from(page.querySelectorAll('p'))) {
    const isCaption = (p.textContent ?? '').includes('Name and Signature of');
    const isName = parseFloat(p.style.marginLeft) === 18;
    if (!isCaption && !isName) continue;
    const gap = Array.from(p.querySelectorAll('span > span')).find((s) => /^[\s\u00a0]+$/.test(s.textContent ?? '') && s.children.length === 0) as HTMLElement | undefined;
    const prev = gap?.parentElement?.previousElementSibling as HTMLElement | null | undefined;
    const next = gap?.parentElement?.nextElementSibling as HTMLElement | null | undefined;
    if (!gap || !prev || !next) continue;
    const pr = p.getBoundingClientRect();
    const margin = parseFloat(getComputedStyle(p).marginLeft) || 0;
    const centre = pr.left - margin + (343.5 * 96) / 72;
    const w = centre - next.getBoundingClientRect().width / 2 - prev.getBoundingClientRect().right;
    if (w > 0) { gap.style.cssText = `display:inline-block;width:${w}px`; gap.textContent = ''; }
  }
  // the form has two rules under the letterhead; only the one under SCHOOLS DIVISION OF LEYTE stays
  for (const p of Array.from(page.querySelectorAll('header p'))) {
    if ((p.textContent ?? '').trim() === 'REGION VIII') (p as HTMLElement).style.borderBottom = 'none';
  }
}

// The template keeps "ANNEX A", the "No.:" box, the footer pictures and "Page 1 of 1" in floating boxes
// that the on-screen layout puts in the wrong place or drops. They are drawn here at the places the
// Word form has them (inches on the A4 page).
async function mediaImg(pkg: TaPackage, name: string): Promise<HTMLImageElement | null> {
  try {
    const f = pkg.zip.file(`word/media/${name}`);
    if (!f) return null;
    const url = URL.createObjectURL(await f.async('blob'));
    try { return await loadImg(url); } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  } catch { return null; }
}

async function drawHeaderFooter(c: HTMLCanvasElement, taNumber: string, pkg: TaPackage) {
  const g = c.getContext('2d')!;
  g.setTransform(1, 0, 0, 1, 0, 0); // html2canvas leaves its own offset on the canvas
  const size = pageSizeIn(pkg);
  const k = c.width / size.w; // pixels per inch
  const serif = '"Bookman Old Style", "Palatino Linotype", Georgia, "Times New Roman", serif';
  const sans = 'Calibri, Carlito, "Segoe UI", Arial, sans-serif';
  const pt = (n: number) => (n / 72) * k;
  g.fillStyle = '#000'; g.strokeStyle = '#000'; g.textBaseline = 'alphabetic';

  // header: ANNEX A (top left) and the No.: box (top right)
  g.font = `bold ${pt(11)}px ${serif}`;
  g.fillText('ANNEX A', 0.83 * k, 0.62 * k);
  g.lineWidth = Math.max(1, pt(0.75));
  g.strokeRect(5.70 * k, 0.58 * k, 1.49 * k, 0.45 * k);
  g.font = `bold ${pt(10)}px ${serif}`;
  g.fillText('No.:', 5.80 * k, 0.98 * k);
  if (taNumber) { g.font = `bold ${pt(11)}px ${serif}`; g.fillText(taNumber, 6.13 * k, 0.98 * k); }
  else { g.beginPath(); g.moveTo(6.11 * k, 1.0 * k); g.lineTo(7.03 * k, 1.0 * k); g.stroke(); }

  // footer: rule, logos, address and page number
  g.lineWidth = pt(1.5);
  g.beginPath(); g.moveTo(1.0 * k, 10.30 * k); g.lineTo(size.w * k - 1.0 * k, 10.30 * k); g.stroke();
  const logos = await mediaImg(pkg, 'image3.png');
  if (logos) g.drawImage(logos, 0.809 * k, 10.39 * k, 1.575 * k, 0.689 * k);
  const seal = await mediaImg(pkg, 'image4.jpg');
  if (seal) g.drawImage(seal, 2.317 * k, 10.40 * k, 0.55 * k, 0.525 * k);
  const lines: [string, string][] = [['Address: ', 'Government Center, Candahug, Palo, Leyte'], ['Telephone No.: ', '(053) 888-3527'], ['Email Address: ', 'leyte.ro8@deped.gov.ph'], ['Website: ', 'https://depedleytedivision.com']];
  lines.forEach(([label, text], i) => {
    let x = 2.99 * k; const y = (10.61 + i * 0.137) * k;
    g.font = `bold ${pt(8)}px ${sans}`; g.fillText(label, x, y); x += g.measureText(label).width;
    g.font = `${pt(8)}px ${sans}`; g.fillText(text, x, y);
  });
  let x = 6.59 * k;
  for (const [t, b] of [['Page ', false], ['1', true], [' of ', false], ['1', true]] as [string, boolean][]) {
    g.font = `${b ? 'bold ' : ''}${pt(9)}px ${sans}`;
    g.fillText(t, x, 10.25 * k);
    x += g.measureText(t).width;
  }
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
