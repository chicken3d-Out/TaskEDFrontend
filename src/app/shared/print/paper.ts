// Paper sizes for printing Form 6 and the Travel Authority (points; 72 per inch).
export interface Paper { id: string; label: string; w: number; h: number }
export const PAPERS: Paper[] = [
  { id: 'a4', label: 'A4 (210 × 297 mm)', w: 595.28, h: 841.89 },
  { id: 'letter', label: 'Letter (8.5 × 11 in)', w: 612, h: 792 },
  { id: 'long', label: 'Long / Folio (8.5 × 13 in)', w: 612, h: 936 },
  { id: 'legal', label: 'Legal (8.5 × 14 in)', w: 612, h: 1008 },
];
const KEY = 'tasked.paper';
export function loadPaper(): Paper {
  try { const id = localStorage.getItem(KEY); return PAPERS.find((p) => p.id === id) ?? PAPERS[0]; } catch { return PAPERS[0]; }
}
export function savePaper(id: string) { try { localStorage.setItem(KEY, id); } catch { /* not kept; A4 next time */ } }
export const paperOf = (id: string) => PAPERS.find((p) => p.id === id) ?? PAPERS[0];

export interface PdfPage { jpeg: Uint8Array; w: number; h: number; wPt: number; hPt: number } // picture, its pixels, and its natural size in points

// A PDF with one picture per page. Each picture keeps its shape: it is fitted inside the paper and centred.
export function pdfFromPages(pages: PdfPage[], paper: { w: number; h: number }): Blob {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let len = 0;
  const offs: number[] = [];
  const push = (u: Uint8Array | string) => { const x = typeof u === 'string' ? enc.encode(u) : u; chunks.push(x); len += x.length; };
  const n = pages.length;
  const W = paper.w.toFixed(2), H = paper.h.toFixed(2);
  push('%PDF-1.4\n');
  offs[1] = len; push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  offs[2] = len; push(`2 0 obj\n<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] /Count ${n} >>\nendobj\n`);
  pages.forEach((p, i) => {
    const po = 3 + i * 3, io = po + 1, co = po + 2;
    const k = Math.min(paper.w / p.wPt, paper.h / p.hPt);
    const w = p.wPt * k, h = p.hPt * k, x = (paper.w - w) / 2, y = (paper.h - h) / 2;
    offs[po] = len; push(`${po} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${io} 0 R >> >> /Contents ${co} 0 R >>\nendobj\n`);
    offs[io] = len; push(`${io} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`); push(p.jpeg); push('\nendstream\nendobj\n');
    const content = `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`;
    offs[co] = len; push(`${co} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
  });
  const total = 3 + n * 3, xr = len;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let i = 1; i < total; i++) push(`${String(offs[i]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF`);
  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}

export const jpegBytes = (c: HTMLCanvasElement) => Uint8Array.from(atob(c.toDataURL('image/jpeg', 0.93).split(',')[1]), (ch) => ch.charCodeAt(0));

// Opens the print dialog for a PDF (a hidden frame; if the browser will not print it there, the PDF opens in a new tab).
export function printPdf(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const fr = document.createElement('iframe');
  fr.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0';
  fr.src = url;
  let done = false;
  const clean = () => setTimeout(() => { fr.remove(); URL.revokeObjectURL(url); }, 60_000);
  fr.onload = () => {
    if (done) return; done = true;
    try { fr.contentWindow?.focus(); fr.contentWindow?.print(); } catch { window.open(url, '_blank'); }
    clean();
  };
  document.body.appendChild(fr);
  setTimeout(() => { if (!done) { done = true; window.open(url, '_blank'); clean(); } }, 4000);
}
