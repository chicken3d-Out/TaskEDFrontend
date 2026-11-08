import JSZip from 'jszip';
import {
  COUNTRY, FIELDS, QUESTIONS, RADIOS, SHEETS, SIGNATURE, TABLES, TableDef,
} from './pds-schema';

// Reads a CS Form 212 (Revised 2026) .xlsx into plain data and writes changes
// back into the SAME file by editing only the cells that changed, so the
// official layout, tick boxes, drop-down and print setup stay exactly as they were.

type Sheet = (typeof SHEETS)[number];
export type Row = Record<string, string>;

export interface PdsData {
  fields: Record<string, string>;
  radios: Record<string, string>;
  country: string;
  tables: Record<string, Row[]>;
  questions: Record<string, { answer: '' | 'yes' | 'no'; details: string; extra: Record<string, string> }>;
}

interface SheetCtx {
  path: string;
  doc: Document;
  ctrl: Record<string, { path: string; doc: Document }>; // by linked cell, e.g. "J13"
}

export interface PdsPackage {
  zip: JSZip;
  sheets: Record<Sheet, SheetCtx>;
  sst: string[];
  dateOrder: Map<number, 'dmy' | 'mdy'>; // cell style index -> date order
  countries: string[];
  original: PdsData;
  tables: TableDef[]; // table positions found in THIS file (rows differ between PDS copies)
  dateRefs: { sheet: Sheet; ref: string }[]; // every "date accomplished" cell
}

export class PdsFormatError extends Error {}

const NF_MARK = 'NOTHING FOLLOWS';
const MARKER_TEXT = '*** NOTHING FOLLOWS ***';
const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

// ---------- small helpers ----------
const colNum = (c: string) => [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const colName = (n: number) => {
  let s = '';
  while (n > 0) { s = String.fromCharCode(65 + ((n - 1) % 26)) + s; n = Math.floor((n - 1) / 26); }
  return s;
};
const splitRef = (ref: string) => {
  const m = /^([A-Z]+)(\d+)$/.exec(ref)!;
  return { col: m[1], row: Number(m[2]) };
};
const parseXml = (s: string) => new DOMParser().parseFromString(s, 'application/xml');
const serialize = (d: Document) =>
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' + new XMLSerializer().serializeToString(d).replace(/^<\?xml[^>]*\?>\s*/, '');
const kids = (el: Element, name: string) => Array.from(el.children).filter((c) => c.localName === name);

function ymd(serial: number): { y: number; m: number; d: number } {
  const ms = Math.round((serial - 25569) * 86400000);
  const dt = new Date(ms);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}
const p2 = (n: number) => String(n).padStart(2, '0');

// ---------- sheet cell access ----------
function sheetData(doc: Document): Element {
  return doc.getElementsByTagNameNS(MAIN_NS, 'sheetData')[0];
}
function findRow(doc: Document, r: number, create = false): Element | null {
  const sd = sheetData(doc);
  let before: Element | null = null;
  for (const row of Array.from(sd.children)) {
    const n = Number(row.getAttribute('r'));
    if (n === r) return row;
    if (n > r) { before = row; break; }
  }
  if (!create) return null;
  const row = doc.createElementNS(MAIN_NS, 'row');
  row.setAttribute('r', String(r));
  sd.insertBefore(row, before);
  return row;
}
function findCell(doc: Document, ref: string, create = false): Element | null {
  const { col, row } = splitRef(ref);
  const rowEl = findRow(doc, row, create);
  if (!rowEl) return null;
  rowEl.removeAttribute('spans');
  const cn = colNum(col);
  let before: Element | null = null;
  for (const c of Array.from(rowEl.children)) {
    const n = colNum(splitRef(c.getAttribute('r')!).col);
    if (n === cn) return c;
    if (n > cn) { before = c; break; }
  }
  if (!create) return null;
  const c = doc.createElementNS(MAIN_NS, 'c');
  c.setAttribute('r', ref);
  rowEl.insertBefore(c, before);
  return c;
}

function cellText(pkg: PdsPackage, sheet: Sheet, ref: string): string {
  const c = findCell(pkg.sheets[sheet].doc, ref);
  if (!c) return '';
  const t = c.getAttribute('t');
  const v = kids(c, 'v')[0]?.textContent ?? '';
  if (t === 's') return pkg.sst[Number(v)] ?? '';
  if (t === 'inlineStr') return Array.from(c.getElementsByTagNameNS(MAIN_NS, 't')).map((x) => x.textContent).join('');
  if (t === 'str' || t === 'e') return t === 'e' ? '' : v;
  if (t === 'b') return v === '1' ? 'TRUE' : 'FALSE';
  if (v === '') return '';
  const n = Number(v);
  const order = pkg.dateOrder.get(Number(c.getAttribute('s') ?? 0));
  if (order && Number.isFinite(n)) {
    const { y, m, d } = ymd(n);
    return order === 'mdy' ? `${p2(m)}/${p2(d)}/${y}` : `${p2(d)}/${p2(m)}/${y}`;
  }
  return Number.isFinite(n) ? String(n) : v;
}
const isTrue = (s: string) => /^(true|1)$/i.test(s.trim());

function clearCell(c: Element) {
  for (const k of Array.from(c.childNodes)) c.removeChild(k);
  c.removeAttribute('t');
}
function setCell(doc: Document, ref: string, value: string | number | boolean | null) {
  const c = findCell(doc, ref, true)!;
  clearCell(c);
  if (value === null || value === '') return;
  if (typeof value === 'boolean') {
    c.setAttribute('t', 'b');
    const v = doc.createElementNS(MAIN_NS, 'v'); v.textContent = value ? '1' : '0'; c.appendChild(v);
  } else if (typeof value === 'number') {
    const v = doc.createElementNS(MAIN_NS, 'v'); v.textContent = String(value); c.appendChild(v);
  } else {
    c.setAttribute('t', 'inlineStr');
    const is = doc.createElementNS(MAIN_NS, 'is');
    const t = doc.createElementNS(MAIN_NS, 't');
    t.setAttribute('xml:space', 'preserve');
    t.textContent = value;
    is.appendChild(t); c.appendChild(is);
  }
}
const asValue = (s: string, num?: boolean): string | number => {
  if (num && /^-?\d+(\.\d+)?$/.test(s.trim())) return Number(s.trim());
  return s;
};

// ---------- merged cells ----------
function mergeEl(doc: Document): Element {
  let m = doc.getElementsByTagNameNS(MAIN_NS, 'mergeCells')[0];
  if (!m) {
    m = doc.createElementNS(MAIN_NS, 'mergeCells');
    const sd = sheetData(doc);
    sd.parentNode!.insertBefore(m, sd.nextSibling);
  }
  return m;
}
function refreshCount(m: Element) { m.setAttribute('count', String(m.children.length)); }
function removeRowMerges(doc: Document, r: number, c1: number, c2: number) {
  const m = mergeEl(doc);
  for (const mc of Array.from(m.children)) {
    const [a, b] = mc.getAttribute('ref')!.split(':');
    const A = splitRef(a), B = splitRef(b ?? a);
    if (A.row === r && B.row === r && colNum(A.col) <= c2 && colNum(B.col) >= c1) m.removeChild(mc);
  }
  refreshCount(m);
}
function addMerge(doc: Document, ref: string) {
  const m = mergeEl(doc);
  const el = doc.createElementNS(MAIN_NS, 'mergeCell');
  el.setAttribute('ref', ref);
  m.appendChild(el);
  refreshCount(m);
}

// ---------- form controls (tick boxes, drop-down) ----------
function setCtrl(sh: SheetCtx, link: string, checked: boolean) {
  const c = sh.ctrl[link];
  if (!c) return;
  const root = c.doc.documentElement;
  if (checked) root.setAttribute('checked', 'Checked'); else root.removeAttribute('checked');
}
function setTick(sh: SheetCtx, ref: string, on: boolean) {
  setCell(sh.doc, ref, on);
  setCtrl(sh, ref, on);
}

// ---------- open ----------
async function readText(zip: JSZip, path: string): Promise<string> {
  const f = zip.file(path);
  if (!f) throw new PdsFormatError('This file is missing part of the form (' + path + ').');
  return f.async('string');
}

export async function openPds(buf: ArrayBuffer): Promise<PdsPackage> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch {
    throw new PdsFormatError('This is not an Excel (.xlsx) file.');
  }
  const wb = parseXml(await readText(zip, 'xl/workbook.xml'));
  const rels = parseXml(await readText(zip, 'xl/_rels/workbook.xml.rels'));
  const relTarget = new Map<string, string>();
  for (const r of Array.from(rels.getElementsByTagName('Relationship'))) relTarget.set(r.getAttribute('Id')!, r.getAttribute('Target')!);
  const sheetPath: Partial<Record<Sheet, string>> = {};
  for (const s of Array.from(wb.getElementsByTagName('sheet'))) {
    const name = s.getAttribute('name') as Sheet;
    const rid = s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    if ((SHEETS as readonly string[]).includes(name) && rid) {
      const t = relTarget.get(rid)!;
      sheetPath[name] = t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '');
    }
  }
  for (const s of SHEETS) {
    if (!sheetPath[s]) throw new PdsFormatError('This does not look like the Personal Data Sheet (CS Form 212): sheet ' + s + ' is missing.');
  }

  // shared strings
  const sst: string[] = [];
  if (zip.file('xl/sharedStrings.xml')) {
    const d = parseXml(await readText(zip, 'xl/sharedStrings.xml'));
    for (const si of Array.from(d.getElementsByTagNameNS(MAIN_NS, 'si'))) {
      // skip phonetic runs (rPh)
      let out = '';
      for (const t of Array.from(si.getElementsByTagNameNS(MAIN_NS, 't'))) {
        if (t.parentElement?.localName === 'rPh') continue;
        out += t.textContent ?? '';
      }
      sst.push(out);
    }
  }

  // date-formatted styles
  const dateOrder = new Map<number, 'dmy' | 'mdy'>();
  if (zip.file('xl/styles.xml')) {
    const st = parseXml(await readText(zip, 'xl/styles.xml'));
    const custom = new Map<number, string>();
    for (const n of Array.from(st.getElementsByTagNameNS(MAIN_NS, 'numFmt'))) custom.set(Number(n.getAttribute('numFmtId')), n.getAttribute('formatCode') ?? '');
    const xfs = st.getElementsByTagNameNS(MAIN_NS, 'cellXfs')[0];
    Array.from(xfs?.children ?? []).forEach((xf, i) => {
      const id = Number(xf.getAttribute('numFmtId') ?? 0);
      let order: 'dmy' | 'mdy' | null = null;
      if (id === 14) order = 'mdy';
      else if ((id >= 15 && id <= 17) || id === 22 || (id >= 45 && id <= 47)) order = 'dmy';
      else if (custom.has(id)) {
        const code = custom.get(id)!.replace(/"[^"]*"|\\.|\[[^\]]*\]/g, '');
        if (/[dy]/i.test(code) && /m|d/i.test(code) && !/[hs]/i.test(code.replace(/mm?/gi, ''))) {
          const d = code.search(/d/i), m = code.search(/m/i);
          if (d >= 0 && m >= 0) order = d < m ? 'dmy' : 'mdy';
        }
      }
      if (order) dateOrder.set(i, order);
    });
  }

  const sheets = {} as Record<Sheet, SheetCtx>;
  for (const s of SHEETS) {
    const path = sheetPath[s]!;
    const doc = parseXml(await readText(zip, path));
    const ctrl: SheetCtx['ctrl'] = {};
    const relPath = path.replace('worksheets/', 'worksheets/_rels/') + '.rels';
    if (zip.file(relPath)) {
      const rd = parseXml(await readText(zip, relPath));
      for (const r of Array.from(rd.getElementsByTagName('Relationship'))) {
        if (!/ctrlProp$/.test(r.getAttribute('Type') ?? '')) continue;
        const target = r.getAttribute('Target')!;
        const cp = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\.\//, '');
        if (!zip.file(cp)) continue;
        const cd = parseXml(await readText(zip, cp));
        const link = cd.documentElement.getAttribute('fmlaLink');
        if (link) ctrl[link.replace(/\$/g, '')] = { path: cp, doc: cd };
      }
    }
    sheets[s] = { path, doc, ctrl };
  }

  const pkg: PdsPackage = { zip, sheets, sst, dateOrder, countries: [], original: null as unknown as PdsData, tables: TABLES, dateRefs: [] };

  for (const sg of SIGNATURE) {
    if (!cellText(pkg, sg.sheet, sg.ref).toLowerCase().includes(sg.includes.toLowerCase())) {
      throw new PdsFormatError(
        'This does not look like the CS Form 212 (Revised 2026) Personal Data Sheet. ' +
          'Older versions of the PDS are laid out differently and cannot be read yet.',
      );
    }
  }

  resolveLayout(pkg);
  for (let r = COUNTRY.listFirst; r <= COUNTRY.listLast; r++) pkg.countries.push(cellText(pkg, 'C1', COUNTRY.listCol + r));
  pkg.original = readData(pkg);
  return pkg;
}

// ---------- layout detection ----------
// Sheet C3 differs between PDS copies (rows are inserted or removed), so its
// tables are located from their headings instead of fixed row numbers.
function resolveLayout(pkg: PdsPackage) {
  const tables: TableDef[] = TABLES.map((t) => ({ ...t, layout: t.layout ? { ...t.layout, merges: [...t.layout.merges] } : undefined }));
  const dateRefs: { sheet: Sheet; ref: string }[] = [{ sheet: 'C1', ref: 'L61' }, { sheet: 'C2', ref: 'J42' }, { sheet: 'C4', ref: 'G64' }];
  const txt = (r: number, col = 'A') => cellText(pkg, 'C3', col + r).trim();
  const find = (from: number, test: (r: number) => boolean) => { for (let r = from; r <= 90; r++) if (test(r)) return r; return -1; };
  const rVI = find(1, (r) => /^VI\./.test(txt(r)));
  const rVII = find(1, (r) => /^VII\./.test(txt(r)));
  const rVIII = find(1, (r) => /^VIII\./.test(txt(r)));
  const rSig = find(1, (r) => /^SIGNATURE/i.test(txt(r)));
  const cont = (from: number) => find(from + 1, (r) => /^\(continue/i.test(txt(r)));
  const lastData = (_first: number, end: number) => end - 1;
  const set = (id: string, first: number, last: number) => {
    const t = tables.find((x) => x.id === id)!;
    const off = t.layout ? t.layout.refRow - t.first : 0;
    t.first = first; t.last = last;
    if (t.layout) t.layout.refRow = Math.min(first + off, last);
  };
  if (rVI > 0 && rVII > rVI && rVIII > rVII && rSig > rVIII) {
    const fromRow = (a: number) => find(a + 1, (r) => /^from$/i.test(txt(r, 'E')));
    const f1 = fromRow(rVI) + 1, c1 = cont(f1);
    const f2 = fromRow(rVII) + 1, c2 = cont(f2);
    const f3 = rVIII + 2, c3 = cont(f3);
    if (f1 > 1 && c1 > f1 && f2 > 1 && c2 > f2 && c3 > f3) {
      set('learning', f1, lastData(f1, c1));
      set('voluntary', f2, lastData(f2, c2));
      for (const id of ['skills', 'distinctions', 'memberships']) set(id, f3, c3 - 1);
      dateRefs.push({ sheet: 'C3', ref: 'I' + rSig });
    }
  }
  if (dateRefs.length === 3) dateRefs.push({ sheet: 'C3', ref: 'I46' });
  pkg.tables = tables;
  pkg.dateRefs = dateRefs;
}

// ---------- read ----------
function readTable(pkg: PdsPackage, t: TableDef): Row[] {
  const rows: Row[] = [];
  const firstCol = t.cols[0].col;
  for (let r = t.first; r <= t.last; r++) {
    if (t.marker && cellText(pkg, t.sheet, firstCol + r).toUpperCase().includes(NF_MARK)) break;
    const row: Row = {};
    let any = false;
    for (const c of t.cols) {
      const v = cellText(pkg, t.sheet, c.col + r).trim();
      row[c.key] = v;
      if (v) any = true;
    }
    if (any || t.fixedLabels) rows.push(row);
  }
  return rows;
}

function stripLabel(v: string): string {
  const s = v.replace(/^\s*if\s+yes[^:]*:\s*/i, '').replace(/_+/g, '').trim();
  return /^(don'?t know)$/i.test(s) ? '' : s;
}

function readData(pkg: PdsPackage): PdsData {
  const fields: Record<string, string> = {};
  for (const f of FIELDS) fields[f.id] = cellText(pkg, f.sheet, f.ref).trim();
  const radios: Record<string, string> = {};
  for (const r of RADIOS) radios[r.id] = r.options.find((o) => isTrue(cellText(pkg, r.sheet, o.ref)))?.value ?? '';
  const idx = Number(cellText(pkg, 'C1', COUNTRY.linkRef)) || 0;
  const country = idx > 1 ? (pkg.countries[idx - 1] ?? '') : '';
  const tables: Record<string, Row[]> = {};
  for (const t of pkg.tables) tables[t.id] = readTable(pkg, t);
  const questions: PdsData['questions'] = {};
  for (const q of QUESTIONS) {
    const yes = isTrue(cellText(pkg, 'C4', q.yes)), no = isTrue(cellText(pkg, 'C4', q.no));
    const raw = q.details ? cellText(pkg, 'C4', q.details.ref).trim() : '';
    const extra: Record<string, string> = {};
    for (const e of q.extra ?? []) extra[e.key] = cellText(pkg, 'C4', e.ref).trim();
    questions[q.id] = {
      answer: yes ? 'yes' : no ? 'no' : '',
      details: q.details?.mode === 'inline' ? stripLabel(raw) : raw,
      extra,
    };
  }
  return { fields, radios, country, tables, questions };
}

export function readPds(pkg: PdsPackage): PdsData {
  return JSON.parse(JSON.stringify(pkg.original));
}

// ---------- write ----------
function normalizeRow(sh: SheetCtx, t: TableDef, r: number) {
  const L = t.layout;
  if (!L) return;
  const doc = sh.doc;
  const c1 = colNum(L.from), c2 = colNum(L.to);
  if (r !== L.refRow) {
    const ref = findRow(doc, L.refRow);
    const row = findRow(doc, r, true)!;
    if (ref?.getAttribute('ht')) { row.setAttribute('ht', ref.getAttribute('ht')!); row.setAttribute('customHeight', '1'); }
    for (let n = c1; n <= c2; n++) {
      const src = findCell(doc, colName(n) + L.refRow);
      const dst = findCell(doc, colName(n) + r, true)!;
      const s = src?.getAttribute('s');
      if (s) dst.setAttribute('s', s); else dst.removeAttribute('s');
    }
  }
  removeRowMerges(doc, r, c1, c2);
  for (const m of L.merges) {
    const [a, b] = m.split(':');
    if (a !== b) addMerge(doc, `${a}${r}:${b}${r}`);
  }
}

function writeTable(pkg: PdsPackage, t: TableDef, rows: Row[]) {
  const sh = pkg.sheets[t.sheet];
  const doc = sh.doc;
  const firstCol = t.cols[0].col;

  if (t.fixedLabels) {
    t.fixedLabels.forEach((_, i) => {
      const r = t.first + i;
      for (const c of t.cols) setCell(doc, c.col + r, asValue(rows[i]?.[c.key] ?? '', c.num));
    });
    return;
  }

  // keep the marker row's look so it matches the rest of the form
  let markerStyle: string | null = null;
  if (t.marker && t.markerCols) {
    for (let r = t.first; r <= t.last; r++) {
      const c = findCell(doc, firstCol + r);
      if (c && cellText(pkg, t.sheet, firstCol + r).toUpperCase().includes(NF_MARK)) { markerStyle = c.getAttribute('s'); break; }
    }
  }

  for (let r = t.first; r <= t.last; r++) {
    normalizeRow(sh, t, r);
    for (const c of t.cols) setCell(doc, c.col + r, null);
  }
  const n = Math.min(rows.length, t.last - t.first + 1);
  for (let i = 0; i < n; i++) {
    for (const c of t.cols) setCell(doc, c.col + (t.first + i), asValue(rows[i][c.key] ?? '', c.num));
  }
  if (t.marker && n < t.last - t.first + 1) {
    const r = t.first + n;
    if (t.markerCols) {
      const [a, b] = t.markerCols.split(':');
      removeRowMerges(doc, r, colNum(a), colNum(b));
      addMerge(doc, `${a}${r}:${b}${r}`);
      const cell = findCell(doc, a + r, true)!;
      if (markerStyle) cell.setAttribute('s', markerStyle);
      setCell(doc, a + r, MARKER_TEXT);
    } else {
      setCell(doc, firstCol + r, MARKER_TEXT);
    }
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export async function buildPds(pkg: PdsPackage, data: PdsData): Promise<Blob> {
  const orig = pkg.original;
  const warnings: string[] = [];

  for (const f of FIELDS) {
    if (data.fields[f.id] === orig.fields[f.id]) continue;
    const v = (data.fields[f.id] ?? '').trim();
    setCell(pkg.sheets[f.sheet].doc, f.ref, asValue(v, f.num));
  }

  // The date accomplished (page 1 and the date under each signature) is always the day it is saved/downloaded.
  const d = new Date();
  const today = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  for (const x of pkg.dateRefs) setCell(pkg.sheets[x.sheet].doc, x.ref, today);

  for (const r of RADIOS) {
    if (data.radios[r.id] === orig.radios[r.id]) continue;
    for (const o of r.options) setTick(pkg.sheets[r.sheet], o.ref, o.value === data.radios[r.id]);
  }

  if (data.country !== orig.country) {
    const sh = pkg.sheets.C1;
    const i = data.country ? pkg.countries.indexOf(data.country) + 1 : 1;
    const idx = i > 0 ? i : 1;
    setCell(sh.doc, COUNTRY.linkRef, idx);
    sh.ctrl[COUNTRY.linkRef]?.doc.documentElement.setAttribute('sel', String(idx));
  }

  for (const t of pkg.tables) {
    if (!t.marker && same(data.tables[t.id], orig.tables[t.id])) continue; // marker tables are always re-written so "*** NOTHING FOLLOWS ***" follows the last entry
    const cap = t.last - t.first + 1;
    if ((data.tables[t.id] ?? []).length > cap) warnings.push(`${t.title}: only ${cap} rows fit on the form.`);
    writeTable(pkg, t, data.tables[t.id] ?? []);
  }

  const c4 = pkg.sheets.C4;
  for (const q of QUESTIONS) {
    const a = data.questions[q.id], o = orig.questions[q.id];
    if (same(a, o)) continue;
    if (a.answer !== o.answer) {
      setTick(c4, q.yes, a.answer === 'yes');
      setTick(c4, q.no, a.answer === 'no');
    }
    if (q.details && (a.details !== o.details || a.answer !== o.answer)) {
      const d = a.details.trim();
      if (q.details.mode === 'cell') setCell(c4.doc, q.details.ref, d);
      else {
        const prefix = q.details.prefix ?? 'If YES, give details: ';
        setCell(c4.doc, q.details.ref, prefix + (d || '_'.repeat(23)));
      }
    }
    for (const e of q.extra ?? []) {
      if (a.extra[e.key] !== o.extra[e.key]) setCell(c4.doc, e.ref, a.extra[e.key].trim());
    }
  }

  for (const s of SHEETS) pkg.zip.file(pkg.sheets[s].path, serialize(pkg.sheets[s].doc));
  for (const s of SHEETS) for (const c of Object.values(pkg.sheets[s].ctrl)) pkg.zip.file(c.path, serialize(c.doc));
  // Excel recalculates on open so nothing stale is shown
  const out = await pkg.zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compression: 'DEFLATE',
  });
  pkg.original = JSON.parse(JSON.stringify(data));
  (out as any).warnings = warnings;
  return out;
}

export const COUNTRY_LIST = (pkg: PdsPackage) => pkg.countries.slice(1).filter(Boolean);
