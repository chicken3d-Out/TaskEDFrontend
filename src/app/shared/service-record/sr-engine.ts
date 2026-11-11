import JSZip from 'jszip';

// Reads the DepEd Service Record form (one sheet) into simple fields and
// writes edited values back into the same workbook. Styles, merged cells,
// logos and layout stay as they are; only cell values change.

const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
export type Row = Record<string, string>;

export interface SrData {
  fields: Record<string, string>;
  rows: Row[];
}
export interface SrPackage { zip: JSZip; sheetPath: string; doc: Document; sst: string[]; }
export class SrFormatError extends Error {}

export interface FieldDef { id: string; label: string; section: string; type?: 'date'; wide?: boolean; hint?: string }
export const SECTIONS = [
  { id: 'employee', title: 'Employee' },
  { id: 'service', title: 'Service record' },
  { id: 'cert', title: 'Purposes & signatories' },
];
export const FIELDS: FieldDef[] = [
  { id: 'employeeNo', label: 'Employee No.', section: 'employee' },
  { id: 'surname', label: 'Family name', section: 'employee' },
  { id: 'first', label: 'First name', section: 'employee' },
  { id: 'mi', label: 'M.I.', section: 'employee' },
  { id: 'birthDate', label: 'Date of birth', section: 'employee', type: 'date' },
  { id: 'birthPlace', label: 'Place of birth', section: 'employee' },
  { id: 'purpose1', label: 'Issued for the following purposes (line 1)', section: 'cert', wide: true },
  { id: 'purpose2', label: 'Issued for the following purposes (line 2)', section: 'cert', wide: true },
  { id: 'preparedName', label: 'Prepared by – name', section: 'cert' },
  { id: 'preparedPos', label: 'Prepared by – position', section: 'cert' },
  { id: 'verifiedName', label: 'Verified & checked by – name', section: 'cert' },
  { id: 'verifiedPos', label: 'Verified & checked by – position', section: 'cert' },
  { id: 'certName', label: 'Certified correct – name', section: 'cert' },
  { id: 'certPos', label: 'Certified correct – position', section: 'cert' },
  { id: 'certExtra1', label: 'Certified correct – extra line 1', section: 'cert' },
  { id: 'certExtra2', label: 'Certified correct – extra line 2', section: 'cert' },
];
export const COLS: { key: string; label: string; type?: 'date' | 'dateOrPresent'; wide?: boolean }[] = [
  { key: 'from', label: 'Inclusive date – from', type: 'date' },
  { key: 'to', label: 'Inclusive date – to', type: 'dateOrPresent' },
  { key: 'designation', label: 'Designation' },
  { key: 'status', label: 'Status (e.g. R/Perm.)' },
  { key: 'salary', label: 'Salary per annum' },
  { key: 'station', label: 'Station / place' },
  { key: 'branch', label: 'Branch' },
  { key: 'leave', label: 'Leave of absence w/o pay' },
  { key: 'sepCause', label: 'Separation – date / cause (e.g. Promotion, NBC No. 601)', wide: true },
];

const CELL: Record<string, string> = {
  employeeNo: 'I11', surname: 'B13', first: 'D13', mi: 'F13', birthDate: 'B16', birthPlace: 'D16',
  purpose1: 'E31', purpose2: 'E32',
  preparedName: 'A37', preparedPos: 'A38', verifiedName: 'H37', verifiedPos: 'H38',
  certName: 'F45', certPos: 'F46', certExtra1: 'F48', certExtra2: 'F49',
};
const ROW_COLS: Record<string, string> = { from: 'A', to: 'B', designation: 'C', status: 'D', salary: 'E', station: 'F', branch: 'G', leave: 'H', sepDate: 'I', sepCause: 'J' };
const FIRST = 24;
const CAP = 6; // lines before the "Issued for the following purposes" block
const DATE_CELL = 'B43'; // "(Date)" above the Certified correct signature

// ---------- helpers ----------
const colNum = (c: string) => [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const splitRef = (ref: string) => { const m = /^([A-Z]+)(\d+)$/.exec(ref)!; return { col: m[1], row: Number(m[2]) }; };
const els = (p: Element | Document, n: string) => Array.from(p.getElementsByTagNameNS(MAIN, n));
const kids = (p: Element, n: string) => Array.from(p.children).filter((c) => c.localName === n);

export const todayLong = (d = new Date()) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
const serial = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000) + 25569;
};
const isoOf = (n: number) => {
  const d = new Date(Math.round((n - 25569) * 86400000));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function sheetData(doc: Document) { return els(doc, 'sheetData')[0]; }
function rowEl(doc: Document, r: number) { return kids(sheetData(doc), 'row').find((x) => Number(x.getAttribute('r')) === r); }
function cellEl(doc: Document, ref: string, create = false): Element | undefined {
  const { col, row } = splitRef(ref);
  const r = rowEl(doc, row);
  if (!r) return undefined;
  let c = kids(r, 'c').find((x) => x.getAttribute('r') === ref);
  if (!c && create) {
    c = doc.createElementNS(MAIN, 'c');
    c.setAttribute('r', ref);
    const after = kids(r, 'c').find((x) => colNum(splitRef(x.getAttribute('r')!).col) > colNum(col));
    r.insertBefore(c, after ?? null);
  }
  return c;
}

function readCell(pkg: SrPackage, ref: string): { text: string; num: number | null } {
  const c = cellEl(pkg.doc, ref);
  if (!c) return { text: '', num: null };
  const t = c.getAttribute('t');
  const v = kids(c, 'v')[0]?.textContent ?? '';
  if (t === 's') return { text: pkg.sst[Number(v)] ?? '', num: null };
  if (t === 'inlineStr') return { text: els(c, 't').map((x) => x.textContent).join(''), num: null };
  if (t === 'str') return { text: v, num: null };
  if (v !== '' && (t === null || t === 'n')) return { text: v, num: Number(v) };
  return { text: v, num: null };
}

function writeCell(doc: Document, ref: string, value: string | number | null) {
  const c = cellEl(doc, ref, true);
  if (!c) return;
  for (const ch of Array.from(c.children)) c.removeChild(ch);
  c.removeAttribute('t');
  if (value === null || value === '') return;
  if (typeof value === 'number') {
    const v = doc.createElementNS(MAIN, 'v');
    v.textContent = String(value);
    c.appendChild(v);
    return;
  }
  c.setAttribute('t', 'inlineStr');
  const is = doc.createElementNS(MAIN, 'is');
  const t = doc.createElementNS(MAIN, 't');
  t.setAttribute('xml:space', 'preserve');
  t.textContent = value;
  is.appendChild(t);
  c.appendChild(is);
}

function mergedRows(doc: Document, col: string): Set<number> {
  const s = new Set<number>();
  for (const m of els(doc, 'mergeCell')) {
    const x = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(m.getAttribute('ref') ?? '');
    if (x && x[1] === col && x[3] !== col && x[2] === x[4]) s.add(Number(x[2]));
  }
  return s;
}

// ---------- open / read ----------
export async function openSr(buf: ArrayBuffer): Promise<SrPackage> {
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(buf); } catch { throw new SrFormatError('This file is not an Excel workbook (.xlsx).'); }
  const path = 'xl/worksheets/sheet1.xml';
  const f = zip.file(path);
  if (!f) throw new SrFormatError('This file is not an Excel workbook (.xlsx).');
  const doc = new DOMParser().parseFromString(await f.async('string'), 'application/xml');
  const sst: string[] = [];
  const sx = zip.file('xl/sharedStrings.xml');
  if (sx) {
    for (const si of els(new DOMParser().parseFromString(await sx.async('string'), 'application/xml'), 'si')) {
      sst.push(Array.from(si.getElementsByTagNameNS(MAIN, 't')).filter((t) => t.parentElement?.localName !== 'rPh').map((t) => t.textContent ?? '').join(''));
    }
  }
  const pkg = { zip, sheetPath: path, doc, sst };
  const all = Array.from({ length: 60 }, (_, i) => readCell(pkg, `A${i + 1}`).text).join(' ');
  if (!/SERVICE RECORD/i.test(all) && !/Inclusive Date of Service/i.test(all)) {
    throw new SrFormatError('This is not the Service Record form. Upload the DepEd Service Record (.xlsx).');
  }
  return pkg;
}

function lastTableRow(pkg: SrPackage): number {
  // the table runs until the "ISSUED FOR THE FOLLOWING PURPOSES" block
  const base = findPurposeRow(pkg);
  return base - 1;
}
function findPurposeRow(pkg: SrPackage): number {
  for (const r of kids(sheetData(pkg.doc), 'row')) {
    const n = Number(r.getAttribute('r'));
    if (n >= FIRST && /ISSUED FOR THE FOLLOWING/i.test(readCell(pkg, `E${n}`).text)) return n;
  }
  return FIRST + CAP;
}

export function readSr(pkg: SrPackage): SrData {
  const fields: Record<string, string> = {};
  const shift = findPurposeRow(pkg) - (FIRST + CAP); // rows added earlier
  const at = (ref: string) => { const { col, row } = splitRef(ref); return `${col}${row >= 30 ? row + shift : row}`; };
  for (const [k, ref] of Object.entries(CELL)) {
    const real = at(ref);
    const c = readCell(pkg, real);
    fields[k] = k === 'birthDate' && c.num != null ? isoOf(c.num) : c.text.trim();
  }
  // purposes sit on the two rows after the label row
  const pr = findPurposeRow(pkg);
  fields['purpose1'] = readCell(pkg, `E${pr + 1}`).text.trim();
  fields['purpose2'] = readCell(pkg, `E${pr + 2}`).text.trim();
  const rows: Row[] = [];
  for (let r = FIRST; r <= lastTableRow(pkg); r++) {
    const row: Row = {};
    for (const [k, col] of Object.entries(ROW_COLS)) {
      const c = readCell(pkg, `${col}${r}`);
      row[k] = (k === 'from' || k === 'to') && c.num != null ? isoOf(c.num) : c.text.trim();
    }
    // the form has one Separation column (date and cause); show it as a single field
    row['sepCause'] = [row['sepDate'], row['sepCause']].filter(Boolean).join(' ');
    row['sepDate'] = '';
    if (Object.values(row).some((v) => v)) rows.push(row);
  }
  return { fields, rows };
}

// ---------- row insertion (when more than the 6 printed lines are needed) ----------
function shiftRows(doc: Document, from: number, by: number) {
  const rows = kids(sheetData(doc), 'row').filter((r) => Number(r.getAttribute('r')) >= from).reverse();
  for (const r of rows) {
    const n = Number(r.getAttribute('r')) + by;
    r.setAttribute('r', String(n));
    for (const c of kids(r, 'c')) c.setAttribute('r', splitRef(c.getAttribute('r')!).col + n);
  }
  for (const m of els(doc, 'mergeCell')) {
    m.setAttribute('ref', (m.getAttribute('ref') ?? '').replace(/([A-Z]+)(\d+)/g, (_x, c: string, r: string) => (Number(r) >= from ? c + (Number(r) + by) : c + r)));
  }
  const dim = els(doc, 'dimension')[0];
  if (dim) dim.setAttribute('ref', (dim.getAttribute('ref') ?? '').replace(/([A-Z]+)(\d+)$/, (_x, c: string, r: string) => c + (Number(r) + by)));
}

function ensureLines(pkg: SrPackage, need: number) {
  const have = lastTableRow(pkg) - FIRST + 1;
  if (need <= have) return;
  const add = need - have;
  const at = lastTableRow(pkg) + 1; // first row of the purposes block
  shiftRows(pkg.doc, at, add);
  const tmpl = rowEl(pkg.doc, at - 1)!;
  const sd = sheetData(pkg.doc);
  const before = rowEl(pkg.doc, at + add)!;
  for (let i = 0; i < add; i++) {
    const copy = tmpl.cloneNode(true) as Element;
    const n = at + i;
    copy.setAttribute('r', String(n));
    for (const c of kids(copy, 'c')) { c.setAttribute('r', splitRef(c.getAttribute('r')!).col + n); for (const ch of Array.from(c.children)) c.removeChild(ch); c.removeAttribute('t'); }
    sd.insertBefore(copy, before);
    // keep the merged separation cell (I:J) of the template row
    for (const m of els(pkg.doc, 'mergeCell')) {
      const x = /^I(\d+):J(\d+)$/.exec(m.getAttribute('ref') ?? '');
      if (x && Number(x[1]) === at - 1) { const mc = pkg.doc.createElementNS(MAIN, 'mergeCell'); mc.setAttribute('ref', `I${n}:J${n}`); m.parentElement!.appendChild(mc); }
    }
  }
  const mcs = els(pkg.doc, 'mergeCells')[0];
  if (mcs) mcs.setAttribute('count', String(els(pkg.doc, 'mergeCell').length));
}

// ---------- build ----------
export async function buildSr(pkg: SrPackage, data: SrData, today = new Date()): Promise<Blob> {
  const xml = new XMLSerializer().serializeToString(pkg.doc);
  const work: SrPackage = { ...pkg, doc: new DOMParser().parseFromString(xml, 'application/xml') };
  const doc = work.doc;
  const rows = data.rows.filter((r) => Object.values(r).some((v) => (v ?? '').trim()));
  ensureLines(work, Math.max(CAP, rows.length));
  const pr = findPurposeRow(work);
  const shift = pr - (FIRST + CAP);
  const at = (ref: string) => { const { col, row } = splitRef(ref); return `${col}${row >= 30 ? row + shift : row}`; };

  const f = data.fields;
  for (const [k, ref] of Object.entries(CELL)) {
    if (k === 'purpose1' || k === 'purpose2') continue;
    const v = (f[k] ?? '').trim();
    if (k === 'birthDate') writeCell(doc, ref, ISO.test(v) ? serial(v) : v);
    else if (k === 'employeeNo') writeCell(doc, at(ref), /^\d+$/.test(v) ? Number(v) : v);
    else writeCell(doc, at(ref), v);
  }
  writeCell(doc, `E${pr + 1}`, (f['purpose1'] ?? '').trim());
  writeCell(doc, `E${pr + 2}`, (f['purpose2'] ?? '').trim());

  const total = lastTableRow(work);
  // the Separation column (date + cause) is one merged cell on every line
  const have = mergedRows(doc, 'I');
  const mcs = els(doc, 'mergeCells')[0];
  for (let r = FIRST; r <= total; r++) {
    if (have.has(r) || !mcs) continue;
    const mc = doc.createElementNS(MAIN, 'mergeCell');
    mc.setAttribute('ref', `I${r}:J${r}`);
    mcs.appendChild(mc);
    writeCell(doc, `J${r}`, null);
  }
  const sepStyle = (() => { for (const r of Array.from(have)) { const c = cellEl(doc, `I${r}`); if (c?.getAttribute('s')) return c.getAttribute('s'); } return null; })();
  if (sepStyle) for (let r = FIRST; r <= total; r++) { const c = cellEl(doc, `I${r}`, true); c?.setAttribute('s', sepStyle); }
  if (mcs) mcs.setAttribute('count', String(els(doc, 'mergeCell').length));
  const merged = mergedRows(doc, 'I');
  for (let r = FIRST; r <= total; r++) {
    const row = rows[r - FIRST];
    for (const [k, col] of Object.entries(ROW_COLS)) {
      let v = (row?.[k] ?? '').trim();
      if (merged.has(r) && k === 'sepDate') { continue; }
      if (merged.has(r) && k === 'sepCause') v = [(row?.['sepDate'] ?? '').trim(), v].filter(Boolean).join(' ');
      const ref = `${merged.has(r) && k === 'sepCause' ? 'I' : col}${r}`;
      if ((k === 'from' || k === 'to') && ISO.test(v)) writeCell(doc, ref, serial(v));
      else if (k === 'salary' && /^[\d,]+(\.\d+)?$/.test(v)) writeCell(doc, ref, Number(v.replace(/,/g, '')));
      else if (k === 'to' && /^present$/i.test(v)) writeCell(doc, ref, 'PRESENT');
      else writeCell(doc, ref, v);
    }
  }
  // the date above "Certified correct" is the day the file is saved or downloaded
  writeCell(doc, at(DATE_CELL), todayLong(today));

  const out = new XMLSerializer().serializeToString(doc);
  pkg.zip.file(pkg.sheetPath, out.startsWith('<?xml') ? out : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + out);
  // make Excel recalculate/reload cleanly
  const blob = await pkg.zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression: 'DEFLATE' });
  // restore the opened sheet so the package can be built again
  pkg.zip.file(pkg.sheetPath, new XMLSerializer().serializeToString(pkg.doc));
  return blob;
}

export const SR_CAP = CAP;
