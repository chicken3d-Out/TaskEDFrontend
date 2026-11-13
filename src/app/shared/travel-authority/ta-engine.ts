import JSZip from 'jszip';

// Reads the DepEd "Travel Authority for Official Travel" Word form
// (DepEd Order No. 043, s. 2022) into plain fields and writes edited values back
// into the same file. Only the text of the cells changes; logos, borders and
// the layout stay as they are. Signatures and dates are left for pen and paper
// unless a date is typed in.

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const FONT = 'Bookman Old Style';

export class TaFormatError extends Error {}

export interface TaData {
  name: string; position: string; station: string; purpose: string; host: string;
  dates: string; destination: string; fund: string;
  requestDate: string; recommending: string; recommendingDate: string; approving: string; approvingDate: string;
}
export interface TaPackage { zip: JSZip; doc: Document; }

export interface TaField { id: keyof TaData; label: string; hint?: string; wide?: boolean; area?: boolean }
export const TA_TRAVEL: TaField[] = [
  { id: 'name', label: 'Name', hint: 'e.g. JUAN D. DELA CRUZ' },
  { id: 'position', label: 'Position / Designation' },
  { id: 'station', label: 'Permanent station', wide: true },
  { id: 'purpose', label: 'Purpose of travel (must be supported by attachments)', wide: true, area: true },
  { id: 'host', label: 'Host of activity' },
  { id: 'dates', label: 'Inclusive dates', hint: 'e.g. May 21, 26, 28, 2026' },
  { id: 'destination', label: 'Destination', wide: true },
  { id: 'fund', label: 'Fund source', hint: 'e.g. Local Funds / Local MOOE' },
];
export const TA_SIGN: TaField[] = [
  { id: 'requestDate', label: 'Requesting employee – date (optional)', hint: 'leave blank to sign by hand' },
  { id: 'recommending', label: 'Recommending authority – name' },
  { id: 'recommendingDate', label: 'Recommending authority – date (optional)' },
  { id: 'approving', label: 'Approving authority – name' },
  { id: 'approvingDate', label: 'Approving authority – date (optional)' },
];

export function emptyTa(): TaData {
  return { name: '', position: '', station: '', purpose: '', host: '', dates: '', destination: '', fund: '', requestDate: '', recommending: '', recommendingDate: '', approving: '', approvingDate: '' };
}

const els = (n: Element | Document, t: string) => Array.from(n.getElementsByTagNameNS(W, t));
const kids = (n: Element, t: string) => Array.from(n.childNodes).filter((c): c is Element => c.nodeType === 1 && (c as Element).localName === t && (c as Element).namespaceURI === W);
const clean = (s: string) => s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

function ptext(p: Element): string {
  let s = '';
  const walk = (n: Node) => {
    for (const c of Array.from(n.childNodes)) {
      if (c.nodeType !== 1) continue;
      const e = c as Element;
      if (e.namespaceURI === W && e.localName === 't') s += e.textContent ?? '';
      else if (e.namespaceURI === W && (e.localName === 'tab')) s += '\t';
      else walk(e);
    }
  };
  walk(p);
  return s;
}

function layout(doc: Document) {
  const tbl = els(doc, 'tbl').find((t) => /NAME/.test(t.textContent ?? '') && /Fund Source/i.test(t.textContent ?? ''));
  if (!tbl) throw new TaFormatError('This is not the Travel Authority form (DepEd Order No. 043, s. 2022).');
  const rows = kids(tbl, 'tr');
  if (rows.length < 11) throw new TaFormatError('The Travel Authority table has fewer rows than expected.');
  return { tbl, rows };
}

const cellsOf = (tr: Element) => kids(tr, 'tc');
const parasOf = (tc: Element) => kids(tc, 'p');

// the paragraph of a signature cell that carries the name and the date line
function signPara(tc: Element): Element | null {
  const ps = parasOf(tc);
  const i = ps.findIndex((p) => /^\s*Name\s+and Signature of/i.test(ptext(p)));
  if (i > 0) return ps[i - 1];
  return ps.find((p) => /_{3,}/.test(ptext(p))) ?? null;
}

function splitSign(p: Element) {
  const parts = ptext(p).split(/\t|\s{3,}|_{3,}/).map((x) => x.trim()).filter(Boolean);
  const name = parts[0] ?? '';
  const date = parts.slice(1).join(' ').replace(/_+/g, '').trim();
  return { name, date };
}

export async function openTa(buf: ArrayBuffer): Promise<TaPackage> {
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(buf); } catch { throw new TaFormatError('This file is not a Word document (.docx).'); }
  const f = zip.file('word/document.xml');
  if (!f) throw new TaFormatError('This file is not a Word document (.docx).');
  const doc = new DOMParser().parseFromString(await f.async('string'), 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new TaFormatError('The Word file could not be read.');
  layout(doc);
  return { zip, doc };
}

const ROW: Record<string, number> = { name: 0, position: 1, station: 2, purpose: 3, host: 4, dates: 5, destination: 6, fund: 7 };

export function readTa(pkg: TaPackage): TaData {
  const { rows } = layout(pkg.doc);
  const d = emptyTa();
  for (const [k, r] of Object.entries(ROW)) {
    const tc = cellsOf(rows[r])[1];
    (d as any)[k] = tc ? clean(parasOf(tc).map(ptext).join(' ')) : '';
  }
  const sp = (r: number) => { const p = signPara(cellsOf(rows[r])[0]); return p ? splitSign(p) : { name: '', date: '' }; };
  const a = sp(8), b = sp(9), c = sp(10);
  d.requestDate = a.date; d.recommending = b.name; d.recommendingDate = b.date; d.approving = c.name; d.approvingDate = c.date;
  if (!d.name) d.name = a.name;
  return d;
}

// ---------- writing ----------
function mk(name: string, attrs: Record<string, string> = {}): Element {
  const e = document.implementation.createDocument(W, 'w:' + name, null).documentElement;
  for (const [k, v] of Object.entries(attrs)) e.setAttributeNS(W, 'w:' + k, v);
  return e;
}
function adopt(doc: Document, e: Element) { return doc.importNode(e, true) as Element; }

function runProps(doc: Document, o: { b?: boolean; u?: boolean; sz?: number }): Element {
  const rpr = mk('rPr');
  const f = mk('rFonts', { ascii: FONT, eastAsia: FONT, hAnsi: FONT, cs: FONT });
  rpr.appendChild(f);
  if (o.b) rpr.appendChild(mk('b'));
  if (o.u) rpr.appendChild(mk('u', { val: 'single' }));
  if (o.sz) { rpr.appendChild(mk('sz', { val: String(o.sz) })); rpr.appendChild(mk('szCs', { val: String(o.sz) })); }
  return adopt(doc, rpr);
}
function textRun(doc: Document, text: string, o: { b?: boolean; u?: boolean; sz?: number }): Element {
  const r = adopt(doc, mk('r'));
  r.appendChild(runProps(doc, o));
  const t = adopt(doc, mk('t'));
  t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
  t.textContent = text;
  r.appendChild(t);
  return r;
}
function tabRun(doc: Document, sz: number): Element {
  const r = adopt(doc, mk('r'));
  r.appendChild(runProps(doc, { sz }));
  r.appendChild(adopt(doc, mk('tab')));
  return r;
}

// Replace everything in a paragraph except its properties with new runs
function resetPara(doc: Document, p: Element, indent: number): void {
  for (const c of Array.from(p.childNodes)) if (!((c as Element).localName === 'pPr' && (c as Element).namespaceURI === W)) p.removeChild(c);
  let ppr = kids(p, 'pPr')[0];
  if (!ppr) { ppr = adopt(doc, mk('pPr')); p.insertBefore(ppr, p.firstChild); }
  for (const t of kids(ppr, 'tabs')) ppr.removeChild(t);
  for (const t of kids(ppr, 'ind')) ppr.removeChild(t);
  const tabs = adopt(doc, mk('tabs'));
  tabs.appendChild(adopt(doc, mk('tab', { val: 'left', pos: '6000' })));
  const ind = adopt(doc, mk('ind', { left: String(indent) }));
  // schema order: ... tabs ... spacing, ind, jc, rPr
  const before = kids(ppr, 'spacing')[0] ?? kids(ppr, 'ind')[0] ?? kids(ppr, 'jc')[0] ?? kids(ppr, 'rPr')[0] ?? null;
  ppr.insertBefore(tabs, kids(ppr, 'spacing')[0] ?? before);
  ppr.insertBefore(ind, kids(ppr, 'jc')[0] ?? kids(ppr, 'rPr')[0] ?? null);
}

function setValue(doc: Document, tc: Element, text: string, bold: boolean) {
  const ps = parasOf(tc);
  const p = ps.find((x) => ptext(x).trim()) ?? ps[0];
  if (!p) return;
  const firstRun = els(p, 'r')[0];
  const rpr = firstRun ? kids(firstRun, 'rPr')[0] : null;
  for (const c of Array.from(p.childNodes)) if (!(((c as Element).localName === 'pPr') && (c as Element).namespaceURI === W)) p.removeChild(c);
  const r = adopt(doc, mk('r'));
  if (rpr) r.appendChild(rpr.cloneNode(true)); else r.appendChild(runProps(doc, { b: bold }));
  const t = adopt(doc, mk('t'));
  t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
  t.textContent = text;
  r.appendChild(t);
  p.appendChild(r);
}

function setSign(doc: Document, tc: Element, who: string, name: string, date: string) {
  const p = signPara(tc);
  if (!p) return;
  const cap = p.nextElementSibling && p.nextElementSibling.localName === 'p' ? (p.nextElementSibling as Element) : null;
  resetPara(doc, p, 360);
  if (name) p.appendChild(textRun(doc, name, { b: true, u: true, sz: 20 }));
  p.appendChild(tabRun(doc, 20));
  p.appendChild(date ? textRun(doc, date, { u: true, sz: 20 }) : textRun(doc, '_________________', { sz: 20 }));
  if (cap) {
    resetPara(doc, cap, 0);
    cap.appendChild(textRun(doc, `Name and Signature of ${who}`, { sz: 18 }));
    cap.appendChild(tabRun(doc, 18));
    cap.appendChild(textRun(doc, 'Date', { sz: 18 }));
  }
}

export interface TaSig { img: string; x: number; y: number; at: string }
export interface TaSigs { requester?: TaSig | null; countersign?: TaSig | null; recommending?: TaSig | null; approving?: TaSig | null }

export const SIG_BOX_IN = { w: 1.5, h: 0.7 }; // a signature is fitted inside this box (inches)

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function dataUrlBytes(url: string): Uint8Array {
  const b = atob(url.split(',')[1] ?? '');
  const a = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
  return a;
}
function pngSize(a: Uint8Array) { const v = new DataView(a.buffer, a.byteOffset); return { w: v.getUint32(16), h: v.getUint32(20) }; }

// Signature size in inches, fitted into SIG_BOX_IN and keeping its proportions.
export function sigSizeIn(w: number, h: number) {
  const k = Math.min(SIG_BOX_IN.w / w, SIG_BOX_IN.h / h);
  return { w: w * k, h: h * k };
}
export function pngSizeOf(url: string) { return pngSize(dataUrlBytes(url)); }

// Page size in inches, from the section settings of the Word file.
export function pageSizeIn(pkg: TaPackage) {
  const pg = els(pkg.doc, 'pgSz')[0];
  const g = (n: string, d: number) => Number(pg?.getAttributeNS(W, n) || pg?.getAttribute('w:' + n)) || d;
  return { w: g('w', 11906) / 1440, h: g('h', 16838) / 1440 };
}

export async function buildTa(pkg: TaPackage, data: TaData, sigs?: TaSigs, images = true): Promise<Blob> {
  const xml = new XMLSerializer().serializeToString(pkg.doc);
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const { rows } = layout(doc);
  for (const [k, r] of Object.entries(ROW)) {
    const tc = cellsOf(rows[r])[1];
    if (tc) setValue(doc, tc, ((data as any)[k] ?? '').trim(), k === 'name');
  }
  const dt = (s: TaSig | null | undefined, fallback: string) => (s ? fmtDate(s.at) : fallback.trim());
  setSign(doc, cellsOf(rows[8])[0], 'Requesting Employee', data.name.trim(), dt(sigs?.requester, data.requestDate));
  setSign(doc, cellsOf(rows[9])[0], 'Recommending Authority', data.recommending.trim(), dt(sigs?.recommending, data.recommendingDate));
  setSign(doc, cellsOf(rows[10])[0], 'Approving Authority', data.approving.trim(), dt(sigs?.approving, data.approvingDate));

  const z = await JSZip.loadAsync(await pkg.zip.generateAsync({ type: 'arraybuffer' }));
  const list = [sigs?.requester, sigs?.countersign, sigs?.recommending, sigs?.approving].filter((x): x is TaSig => !!x);
  if (list.length && images) await addSignatures(z, doc, list, pageSizeIn(pkg));
  z.file('word/document.xml', new XMLSerializer().serializeToString(doc));
  return z.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
}

// Adds each signature as a picture floating at the tapped spot on the page.
async function addSignatures(z: JSZip, doc: Document, list: TaSig[], page: { w: number; h: number }) {
  const RELS = 'word/_rels/document.xml.rels';
  let rels = await z.file(RELS)!.async('string');
  const body = els(doc, 'body')[0];
  const p0 = kids(body, 'p')[0];
  if (!p0) return;
  const EMU = 914400;
  list.forEach((s, i) => {
    const bytes = dataUrlBytes(s.img);
    const n = i + 1;
    z.file(`word/media/ta_sig${n}.png`, bytes);
    rels = rels.replace('</Relationships>', `<Relationship Id="rIdTaSig${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/ta_sig${n}.png"/></Relationships>`);
    const sz = sigSizeIn(pngSize(bytes).w, pngSize(bytes).h);
    const cx = Math.round(sz.w * EMU), cy = Math.round(sz.h * EMU);
    const px = Math.max(0, Math.round(s.x * page.w * EMU - cx / 2));
    const py = Math.max(0, Math.round(s.y * page.h * EMU - cy / 2));
    const frag = `<w:r xmlns:w="${W}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="${251659264 + n}" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>${px}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>${py}</wp:posOffset></wp:positionV><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="${9000 + n}" name="Signature ${n}"/><wp:cNvGraphicFramePr/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="ta_sig${n}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdTaSig${n}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`;
    const r = new DOMParser().parseFromString(frag, 'application/xml').documentElement;
    p0.appendChild(doc.importNode(r, true));
  });
  z.file(RELS, rels);
  const CT = '[Content_Types].xml';
  let ct = await z.file(CT)!.async('string');
  if (!/Extension="png"/i.test(ct)) { ct = ct.replace(/<Types([^>]*)>/, '<Types$1><Default Extension="png" ContentType="image/png"/>'); z.file(CT, ct); }
}

export const TEMPLATE_URL = '/assets/travel-authority-template.docx';
