import JSZip from 'jszip';

// Reads the official SALN Word form (2025 SALN Form, CSC Res. 2500632) into
// plain fields and writes edited values back into the same file. Only the text
// of the cells changes; the layout, fonts and the notarial part stay as they are.

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
export type Row = Record<string, string>;

export interface SalnData {
  compliance: '' | 'assumption' | 'annual' | 'exit';
  filingMode: '' | 'joint' | 'separate' | 'na';
  marriageNA: boolean;
  noBusiness: boolean;
  noRelatives: boolean;
  fields: Record<string, string>;
  tables: Record<string, Row[]>;
}

export interface SalnPackage { zip: JSZip; doc: Document; }

export class SalnFormatError extends Error {}

export interface FieldDef { id: string; label: string; section: string; wide?: boolean; hint?: string }
export interface ColDef { key: string; label: string; wide?: boolean }
export interface TableDef {
  id: string; section: string; title: string; rowLabel: string; cols: ColDef[];
  cap: number; // rows the form has room for before a row is added
  money?: string; // column key that is added up
}

export const SECTIONS = [
  { id: 'filing', title: 'Filing' },
  { id: 'declarant', title: 'Declarant & spouse' },
  { id: 'children', title: 'Children' },
  { id: 'assets', title: 'Assets' },
  { id: 'liabilities', title: 'Liabilities & net worth' },
  { id: 'business', title: 'Business & relatives' },
  { id: 'ids', title: 'Certification' },
];

export const FIELDS: FieldDef[] = [
  { id: 'asOfAssumption', label: 'Assumption of office, as of (date)', section: 'filing', hint: 'e.g. July 1, 2026' },
  { id: 'year', label: 'Annual filing: year (as of December 31)', section: 'filing' },
  { id: 'asOfExit', label: 'Exit, as of (date)', section: 'filing', hint: 'e.g. May 31, 2026' },

  { id: 'surname', label: 'Family name', section: 'declarant' },
  { id: 'first', label: 'First name', section: 'declarant' },
  { id: 'mi', label: 'M.I.', section: 'declarant' },
  { id: 'position', label: 'Position', section: 'declarant' },
  { id: 'agency', label: 'Agency / office', section: 'declarant' },
  { id: 'address', label: 'Address', section: 'declarant', wide: true },
  { id: 'officeAddr1', label: 'Office address (line 1)', section: 'declarant' },
  { id: 'officeAddr2', label: 'Office address (line 2)', section: 'declarant' },
  { id: 'spSurname', label: 'Spouse – family name', section: 'declarant' },
  { id: 'spFirst', label: 'Spouse – first name', section: 'declarant' },
  { id: 'spMi', label: 'Spouse – M.I.', section: 'declarant' },
  { id: 'spPosition', label: 'Spouse – position', section: 'declarant' },
  { id: 'spAgency', label: 'Spouse – agency / office', section: 'declarant' },
  { id: 'spOffice', label: 'Spouse – office address', section: 'declarant', wide: true },
  { id: 'marriage1', label: 'Multiple marriages – spouse name (line 1)', section: 'declarant', wide: true },
  { id: 'marriage2', label: 'Multiple marriages – spouse name (line 2)', section: 'declarant', wide: true },

  { id: 'idType', label: 'Declarant – government issued ID', section: 'ids' },
  { id: 'idNo', label: 'Declarant – ID No.', section: 'ids' },
  { id: 'idDate', label: 'Declarant – date issued', section: 'ids' },
  { id: 'spIdType', label: 'Spouse – government issued ID', section: 'ids' },
  { id: 'spIdNo', label: 'Spouse – ID No.', section: 'ids' },
  { id: 'spIdDate', label: 'Spouse – date issued', section: 'ids' },
];

export const TABLES: TableDef[] = [
  { id: 'children', section: 'children', title: 'Unmarried children below 18 living in your household', rowLabel: 'child', cap: 3,
    cols: [{ key: 'name', label: 'Name of child', wide: true }, { key: 'age', label: 'Age' }] },
  { id: 'real', section: 'assets', title: 'a. Real properties', rowLabel: 'property', cap: 4, money: 'cost',
    cols: [
      { key: 'desc', label: 'Description' }, { key: 'kind', label: 'Kind' }, { key: 'loc', label: 'Exact location' },
      { key: 'assessed', label: 'Assessed value' }, { key: 'fmv', label: 'Current fair market value' },
      { key: 'year', label: 'Acquisition year' }, { key: 'mode', label: 'Mode of acquisition' }, { key: 'cost', label: 'Acquisition cost' },
    ] },
  { id: 'personal', section: 'assets', title: 'b. Personal properties', rowLabel: 'property', cap: 6, money: 'cost',
    cols: [{ key: 'desc', label: 'Description', wide: true }, { key: 'year', label: 'Acquisition year' }, { key: 'cost', label: 'Acquisition cost / amount' }] },
  { id: 'liabilities', section: 'liabilities', title: 'Liabilities', rowLabel: 'liability', cap: 4, money: 'balance',
    cols: [{ key: 'nature', label: 'Nature' }, { key: 'creditor', label: 'Name of creditor' }, { key: 'balance', label: 'Outstanding balance' }] },
  { id: 'business', section: 'business', title: 'Business interests and financial connections', rowLabel: 'entry', cap: 3,
    cols: [{ key: 'entity', label: 'Name of entity / business enterprise' }, { key: 'address', label: 'Business address' }, { key: 'nature', label: 'Nature of interest / connection' }, { key: 'date', label: 'Date of acquisition' }] },
  { id: 'relatives', section: 'business', title: 'Relatives in the government service (within the 4th degree)', rowLabel: 'relative', cap: 5,
    cols: [{ key: 'name', label: 'Name of relative' }, { key: 'relationship', label: 'Relationship' }, { key: 'position', label: 'Position' }, { key: 'agency', label: 'Agency / office and address' }] },
];

// ---------- helpers ----------
const els = (p: Element | Document, n: string) => Array.from(p.getElementsByTagNameNS(W, n));
const kids = (p: Element, n: string) => Array.from(p.children).filter((c) => c.localName === n && c.namespaceURI === W);
const kid = (p: Element, n: string) => kids(p, n)[0] as Element | undefined;
const textOf = (e: Element) => els(e, 't').map((t) => t.textContent ?? '').join('');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const longDate = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
// Filing runs at the start of the year, as of December 31 of the year before.
export const defaultFilingYear = (d = new Date()) => String(d.getMonth() <= 5 ? d.getFullYear() - 1 : d.getFullYear());

const CHECKED = new Set(['F078', 'F0FE', 'F0FD', 'F06E', 'F0A8']);
const BOX = 'F071';
const CHECK = 'F0FE';

function body(doc: Document) { return els(doc, 'body')[0]; }
function paragraphs(doc: Document) { return els(body(doc), 'p').filter((p) => !p.closest('w\\:tc') && !isInCell(p)); }
function isInCell(p: Element) { let n = p.parentElement; while (n) { if (n.localName === 'tc') return true; n = n.parentElement; } return false; }
function tables(doc: Document) { return kids(body(doc), 'tbl'); }
function rowsOf(tbl: Element) { return kids(tbl, 'tr'); }
function cellsOf(tr: Element) { return kids(tr, 'tc'); }

function findTable(doc: Document, ...needles: string[]) {
  const t = tables(doc).find((tb) => needles.every((n) => textOf(tb).includes(n)));
  if (!t) throw new SalnFormatError('This is not the official SALN form (2025 SALN Form). A table is missing: ' + needles[0]);
  return t;
}
function findPara(doc: Document, test: (t: string) => boolean, nth = 0) {
  const p = paragraphs(doc).filter((x) => test(textOf(x)))[nth];
  if (!p) throw new SalnFormatError('This is not the official SALN form (2025 SALN Form).');
  return p;
}

const syms = (p: Element) => els(p, 'sym');
const symChar = (s: Element) => (s.getAttributeNS(W, 'char') ?? '').toUpperCase();
const isChecked = (s: Element) => CHECKED.has(symChar(s));
function setSym(s: Element, on: boolean) { s.setAttributeNS(W, 'w:char', on ? CHECK : BOX); }

// ---------- cell text ----------
function cloneRun(from: Element | null | undefined) { return from ? (from.cloneNode(true) as Element) : null; }

function setCellText(tc: Element, value: string, tmpl?: Element | null) {
  const ps = kids(tc, 'p');
  const p = ps[0];
  for (const extra of ps.slice(1)) tc.removeChild(extra);
  const runs = kids(p, 'r');
  let keep = runs.find((r) => els(r, 't').length > 0) ?? null;
  if (!keep && tmpl) {
    const tr = els(tmpl, 'r').find((r) => els(r, 't').length > 0) ?? null;
    const c = cloneRun(tr);
    if (c) { for (const t of els(c, 't').slice(1)) t.remove(); keep = c; }
  }
  if (tmpl) {
    const tp = kid(kids(tmpl, 'p')[0] ?? tmpl, 'pPr');
    if (tp) {
      const old = kid(p, 'pPr');
      if (old) p.removeChild(old);
      p.insertBefore(tp.cloneNode(true), p.firstChild);
    }
  }
  if (!keep) {
    keep = p.ownerDocument.createElementNS(W, 'w:r');
    const mark = kid(p, 'pPr') && kid(kid(p, 'pPr')!, 'rPr');
    if (mark) keep.appendChild(mark.cloneNode(true));
  }
  for (const r of runs) if (r !== keep) p.removeChild(r);
  for (const x of Array.from(p.children)) if (['hyperlink', 'proofErr', 'bookmarkStart', 'bookmarkEnd', 'smartTag'].includes(x.localName)) p.removeChild(x);
  let t = els(keep, 't')[0];
  for (const x of els(keep, 't').slice(1)) x.remove();
  for (const x of kids(keep, 'tab')) x.remove();
  if (!t) { t = p.ownerDocument.createElementNS(W, 'w:t'); keep.appendChild(t); }
  t.textContent = value;
  t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
  if (keep.parentNode !== p) p.appendChild(keep);
}

const clean = (s: string) => s.replace(/_+/g, '').replace(/\s+/g, ' ').trim();
const isNA = (s: string) => /^n\s*\/\s*a$/i.test(s.trim());

// "_____ value _____" like the printed lines on the form
function lined(value: string, width = 46) {
  if (!value) return '_'.repeat(width);
  const pad = Math.max(2, Math.floor((width - value.length) / 2));
  return '_'.repeat(pad) + value + '_'.repeat(pad);
}

// ---------- money ----------
const amount = (s: string) => Number((s ?? '').replace(/[^0-9.\-]/g, '')) || 0;
function money(n: number, decimals: boolean) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals ? 2 : 0, maximumFractionDigits: 2 });
}

// ---------- locations ----------
function layout(doc: Document) {
  const decl = findTable(doc, 'DECLARANT:', 'SPOUSE:');
  const children = findTable(doc, 'UNMARRIED CHILDREN', 'NAME OF CHILD');
  const real = findTable(doc, 'ASSESSED VALUE', 'Subtotal');
  const personal = findTable(doc, 'ACQUISITION YEAR', 'TOTAL ASSETS');
  const liab = findTable(doc, 'OUTSTANDING BALANCE', 'NET WORTH');
  const biz = findTable(doc, 'NAME OF ENTITY');
  const rel = findTable(doc, 'NAME OF RELATIVE');
  const sign = findTable(doc, 'Signature of Declarant', 'ID No.');
  const pCompliance = findPara(doc, (t) => t.includes('Assumption') && t.includes('Annual filing'));
  const pFiling = findPara(doc, (t) => t.includes('Joint Filing') && t.includes('Separate Filing'));
  const pMarr1 = findPara(doc, (t) => t.includes('_') && t.includes('Not Applicable') && !t.includes('Joint'));
  const pMarr2 = (() => { let n = pMarr1.nextElementSibling; while (n && !(n.localName === 'p' && textOf(n).includes('___'))) n = n.nextElementSibling; return n as Element | null; })();
  const pBiz = findPara(doc, (t) => t.includes('do not have any business interest'));
  const pRel = findPara(doc, (t) => t.includes('do not know of any relative'));
  const pDate = findPara(doc, (t) => /^\s*Date:/.test(t));
  return { decl, children, real, personal, liab, biz, rel, sign, pCompliance, pFiling, pMarr1, pMarr2, pBiz, pRel, pDate };
}

const cell = (tbl: Element, r: number, c: number) => cellsOf(rowsOf(tbl)[r] ?? tbl)[c] as Element | undefined;
const cellText = (tbl: Element, r: number, c: number) => { const x = cell(tbl, r, c); return x ? textOf(x) : ''; };

// declarant / spouse / id positions (row, cell index)
const POS: Record<string, [number, number]> = {
  surname: [0, 1], first: [0, 2], mi: [0, 3], position: [0, 6], agency: [1, 6], address: [2, 1], officeAddr1: [2, 4], officeAddr2: [3, 6],
  spSurname: [4, 1], spFirst: [4, 2], spMi: [4, 3], spPosition: [4, 6], spAgency: [5, 6], spOffice: [6, 6],
};
const SIGN_POS: Record<string, [number, number]> = {
  idType: [3, 1], idNo: [4, 1], idDate: [5, 1], spIdType: [3, 4], spIdNo: [4, 4], spIdDate: [5, 4],
};
const TCOLS: Record<string, { first: number; cols: Record<string, number> }> = {
  children: { first: 2, cols: { name: 0, age: 1 } },
  real: { first: 2, cols: { desc: 0, kind: 1, loc: 2, assessed: 3, fmv: 4, year: 5, mode: 6, cost: 7 } },
  personal: { first: 1, cols: { desc: 0, year: 1, cost: 2 } },
  liabilities: { first: 1, cols: { nature: 0, creditor: 1, balance: 2 } },
  business: { first: 1, cols: { entity: 0, address: 1, nature: 2, date: 3 } },
  relatives: { first: 1, cols: { name: 0, relationship: 1, position: 2, agency: 3 } },
};

// ---------- open / read ----------
export async function openSaln(buf: ArrayBuffer): Promise<SalnPackage> {
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(buf); } catch { throw new SalnFormatError('This file is not a Word document (.docx).'); }
  const f = zip.file('word/document.xml');
  if (!f) throw new SalnFormatError('This file is not a Word document (.docx).');
  const doc = new DOMParser().parseFromString(await f.async('string'), 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new SalnFormatError('The Word file could not be read.');
  layout(doc); // throws if it is not the SALN form
  return { zip, doc };
}

export function readSaln(pkg: SalnPackage): SalnData {
  const L = layout(pkg.doc);
  const fields: Record<string, string> = {};
  for (const [k, [r, c]] of Object.entries(POS)) fields[k] = clean(cellText(L.decl, r, c));
  for (const [k, [r, c]] of Object.entries(SIGN_POS)) fields[k] = clean(cellText(L.sign, r, c));

  const cs = syms(L.pCompliance);
  const comp = cs.findIndex(isChecked);
  const cruns = els(L.pCompliance, 't');
  const full = cruns.map((t) => t.textContent ?? '');
  const ai = full.findIndex((x) => /^\s*as of/i.test(x));
  fields['asOfAssumption'] = ai >= 0 ? clean(full[ai].replace(/^\s*as of/i, '')) : '';
  const yi = full.findIndex((t) => t.includes('Annual filing'));
  fields['year'] = yi >= 0 ? (full.slice(yi, yi + 3).join('').match(/(\d{4})/)?.[1] ?? '') : '';
  const ei = full.findIndex((t) => t.includes('Exit'));
  fields['asOfExit'] = ei >= 0 ? clean(full[ei].replace(/^.*as of/i, '')) : '';

  const fm = syms(L.pFiling).findIndex(isChecked);
  const m1 = clean(textOf(L.pMarr1).replace(/Not Applicable/, ''));
  fields['marriage1'] = isNA(m1) ? '' : m1;
  fields['marriage2'] = L.pMarr2 ? clean(textOf(L.pMarr2)) : '';

  const tablesOut: Record<string, Row[]> = {};
  const tbls: Record<string, Element> = { children: L.children, real: L.real, personal: L.personal, liabilities: L.liab, business: L.biz, relatives: L.rel };
  for (const def of TABLES) {
    const loc = TCOLS[def.id];
    const rows = rowsOf(tbls[def.id]);
    const out: Row[] = [];
    for (let r = loc.first; r < rows.length; r++) {
      const cs2 = cellsOf(rows[r]);
      const maxCol = Math.max(...Object.values(loc.cols));
      if (cs2.length <= maxCol) break; // totals row
      const row: Row = {};
      for (const [k, c] of Object.entries(loc.cols)) { const v = clean(textOf(cs2[c])); row[k] = isNA(v) ? '' : v; }
      if (Object.values(row).some((v) => v)) out.push(row);
      if (r - loc.first >= 40) break;
      // stop at the subtotal / total lines
      const label = clean(textOf(rows[r]));
      if (/subtotal|total/i.test(label) && !Object.values(row).some((v) => v && !/total/i.test(v))) { out.pop(); break; }
    }
    tablesOut[def.id] = trimTotals(def, loc, out);
  }
  return {
    compliance: comp === 0 ? 'assumption' : comp === 1 ? 'annual' : comp === 2 ? 'exit' : '',
    filingMode: fm === 0 ? 'joint' : fm === 1 ? 'separate' : fm === 2 ? 'na' : '',
    marriageNA: syms(L.pMarr1).some(isChecked),
    noBusiness: syms(L.pBiz).some(isChecked),
    noRelatives: syms(L.pRel).some(isChecked),
    fields,
    tables: tablesOut,
  };
}

// Data rows end where the capacity of the form's blank rows ends; a row whose
// cells hold a "Subtotal"/"Total" label was already dropped above.
function trimTotals(def: TableDef, _loc: unknown, rows: Row[]) {
  return rows.filter((r) => !Object.values(r).some((v) => /^(sub)?total/i.test(v)));
}

// ---------- build ----------
function ensureRows(tbl: Element, loc: { first: number }, need: number, cap: number) {
  const rows = rowsOf(tbl);
  const last = rows[loc.first + cap - 1];
  let at = last;
  for (let i = cap; i < need; i++) {
    const copy = last.cloneNode(true) as Element;
    for (const t of els(copy, 't')) t.textContent = '';
    at.parentNode!.insertBefore(copy, at.nextSibling);
    at = copy;
  }
}

function tmplFor(tbl: Element, first: number, col: number) {
  const rows = rowsOf(tbl);
  for (let r = first; r < rows.length; r++) {
    const c = cellsOf(rows[r])[col];
    if (c && els(c, 'r').some((x) => els(x, 't').length)) return c;
  }
  return null;
}

export async function buildSaln(pkg: SalnPackage, data: SalnData, today = new Date()): Promise<Blob> {
  // work on a fresh copy of the document so the opened package stays reusable
  const xml = new XMLSerializer().serializeToString(pkg.doc);
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const L = layout(doc);
  const f = data.fields;

  for (const [k, [r, c]] of Object.entries(POS)) {
    let v = (f[k] ?? '').trim();
    if (!v && ['spSurname', 'spAgency'].includes(k) && !['spFirst', 'spMi', 'spPosition', 'spOffice'].some((x) => (f[x] ?? '').trim())) v = 'N/A';
    const target = cell(L.decl, r, c);
    if (target) setCellText(target, v, els(target, 't').length ? null : cell(L.decl, 0, c));
  }
  for (const [k, [r, c]] of Object.entries(SIGN_POS)) {
    const target = cell(L.sign, r, c);
    if (target) setCellText(target, (f[k] ?? '').trim(), cell(L.sign, r, 1));
  }

  // compliance line
  const cs = syms(L.pCompliance);
  ['assumption', 'annual', 'exit'].forEach((k, i) => cs[i] && setSym(cs[i], data.compliance === k));
  const ts = els(L.pCompliance, 't');
  const asOfT = ts.find((t) => /^\s*as of/i.test(t.textContent ?? ''));
  if (asOfT) asOfT.textContent = `as of ${f['asOfAssumption']?.trim() || '____________'}`;
  const iAnnual = ts.findIndex((t) => (t.textContent ?? '').includes('Annual filing'));
  if (iAnnual >= 0) {
    const yearT = ts.slice(iAnnual + 1).find((t) => /^\s*\d{4}\s*$/.test(t.textContent ?? ''));
    const yr = (f['year'] ?? '').trim() || defaultFilingYear(today);
    if (yearT) yearT.textContent = yr;
  }
  const exitT = ts.find((t) => /Exit/.test(t.textContent ?? ''));
  if (exitT) exitT.textContent = `Exit as of ${f['asOfExit']?.trim() || '____________'}`;

  // spouse filing + marriages
  const fs = syms(L.pFiling);
  ['joint', 'separate', 'na'].forEach((k, i) => fs[i] && setSym(fs[i], data.filingMode === k));
  const m1 = (f['marriage1'] ?? '').trim();
  const mruns = els(L.pMarr1, 't');
  if (mruns.length >= 3) {
    const na = data.marriageNA || !m1;
    mruns[0].textContent = na ? '_________________________' : '_'.repeat(Math.max(2, Math.floor((50 - m1.length) / 2)));
    mruns[1].textContent = na ? 'N/A' : m1;
    mruns[2].textContent = na ? '_______________________' : '_'.repeat(Math.max(2, Math.floor((50 - m1.length) / 2)));
  }
  syms(L.pMarr1).forEach((s) => setSym(s, data.marriageNA || !m1));
  if (L.pMarr2) {
    const m2 = (f['marriage2'] ?? '').trim();
    const runs = els(L.pMarr2, 't');
    if (runs[0]) { runs[0].textContent = lined(m2, 52); for (const t of runs.slice(1)) t.textContent = ''; }
  }

  // tables
  const tbls: Record<string, Element> = { children: L.children, real: L.real, personal: L.personal, liabilities: L.liab, business: L.biz, relatives: L.rel };
  const decimals = (['real', 'personal', 'liabilities'] as const).some((id) => data.tables[id]?.some((r) => /\.\d*[1-9]/.test(r[id === 'liabilities' ? 'balance' : 'cost'] ?? '')));
  for (const def of TABLES) {
    const loc = TCOLS[def.id];
    const tbl = tbls[def.id];
    const entries = (data.tables[def.id] ?? []).filter((r) => Object.values(r).some((v) => (v ?? '').trim()));
    ensureRows(tbl, loc, entries.length, def.cap);
    const rows = rowsOf(tbl);
    const slots = Math.max(def.cap, entries.length);
    const tm: Record<string, Element | null> = {};
    for (const [k, c] of Object.entries(loc.cols)) tm[k] = tmplFor(tbl, loc.first, c);
    for (let i = 0; i < slots; i++) {
      const cs2 = cellsOf(rows[loc.first + i]);
      const row = entries[i];
      for (const [k, c] of Object.entries(loc.cols)) {
        if (!cs2[c]) continue;
        let v = row ? (row[k] ?? '').trim() : '';
        if (!row && i === 0 && !entries.length) v = 'N/A';
        if (def.id === 'children') v = v && v !== 'N/A' || (i === 0 && !entries.length) ? '_'.repeat(c === 0 ? 10 : 6) + v + '_'.repeat(c === 0 ? 10 : 6) : '_'.repeat(c === 0 ? 70 : 19);
        setCellText(cs2[c], v, tm[k]);
      }
    }
  }
  const sum = (id: string, key: string) => (data.tables[id] ?? []).reduce((a, r) => a + amount(r[key] ?? ''), 0);
  const realSub = sum('real', 'cost'), perSub = sum('personal', 'cost'), liab = sum('liabilities', 'balance');
  const hasReal = (data.tables['real'] ?? []).some((r) => r['cost']);
  const lastCell = (tbl: Element, label: RegExp) => {
    const tr = rowsOf(tbl).find((r) => label.test(textOf(r)));
    const cs3 = tr ? cellsOf(tr) : [];
    return cs3[cs3.length - 1];
  };
  const put = (tbl: Element, label: RegExp, v: string) => { const c = lastCell(tbl, label); if (c) setCellText(c, v, null); };
  put(L.real, /Subtotal/, hasReal ? money(realSub, decimals) : '');
  put(L.personal, /Subtotal/, money(perSub, decimals));
  put(L.personal, /TOTAL ASSETS/, money(realSub + perSub, decimals));
  put(L.liab, /TOTAL LIABILITIES/, money(liab, decimals));
  put(L.liab, /NET WORTH/, money(realSub + perSub - liab, decimals));

  // "none" boxes
  const noBiz = data.noBusiness || !(data.tables['business'] ?? []).some((r) => Object.values(r).some((v) => (v ?? '').trim()));
  const noRel = data.noRelatives || !(data.tables['relatives'] ?? []).some((r) => Object.values(r).some((v) => (v ?? '').trim()));
  syms(L.pBiz).forEach((s) => setSym(s, noBiz));
  syms(L.pRel).forEach((s) => setSym(s, noRel));

  // the date next to the signature is the date of this download
  const dts = els(L.pDate, 't');
  const di = dts.findIndex((t) => /\d{4}|[A-Za-z]{3,}\s+\d/.test(t.textContent ?? '') && !/^\s*Date:/.test(t.textContent ?? ''));
  const stamp = longDate(today);
  if (di >= 0) { dts[di].textContent = ' ' + stamp; for (const t of dts.slice(di + 1)) t.textContent = ''; }
  else { const last = dts[dts.length - 1]; last.textContent = (last.textContent ?? '') + ' ' + stamp; }

  const out = new XMLSerializer().serializeToString(doc);
  const decl = out.startsWith('<?xml') ? '' : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  pkg.zip.file('word/document.xml', decl + out);
  return pkg.zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
}

export function totals(data: SalnData) {
  const sum = (id: string, key: string) => (data.tables[id] ?? []).reduce((a, r) => a + amount(r[key] ?? ''), 0);
  const real = sum('real', 'cost'), personal = sum('personal', 'cost'), liab = sum('liabilities', 'balance');
  return { real, personal, assets: real + personal, liab, net: real + personal - liab };
}
export const peso = (n: number) => money(n, !Number.isInteger(n));
