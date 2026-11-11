import JSZip from 'jszip';

// Draws the Personal Data Sheet the way it looks when printed: every sheet
// (C1-C4) is cut at its print area and page breaks, with the real column
// widths, merged cells, borders, fills, fonts, tick boxes and text boxes.
// Nothing is editable here - it is only a picture of the file.

export interface PdsPage { title: string; width: number; height: number; html: string; }

const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const XDR = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const EMU = 9525;

const INDEXED = [
  '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF', '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF',
  '800000', '008000', '000080', '808000', '800080', '008080', 'C0C0C0', '808080', '9999FF', '993366', 'FFFFCC', 'CCFFFF', '660066', 'FF8080', '0066CC', 'CCCCFF',
  '000080', 'FF00FF', 'FFFF00', '00FFFF', '800080', '800000', '008080', '0000FF', '00CCFF', 'CCFFFF', 'CCFFCC', 'FFFF99', '99CCFF', 'FF99CC', 'CC99FF', 'FFCC99',
  '3366FF', '33CCCC', '99CC00', 'FFCC00', 'FF9900', 'FF6600', '666699', '969696', '003366', '339966', '003300', '333300', '993300', '993366', '333399', '333333',
];

const parse = (s: string) => new DOMParser().parseFromString(s, 'application/xml');
const kids = (el: Element | null | undefined, name: string) => Array.from(el?.children ?? []).filter((c) => c.localName === name);
const kid = (el: Element | null | undefined, name: string) => kids(el, name)[0] as Element | undefined;
const colNum = (c: string) => [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const text = async (zip: JSZip, p: string) => { const f = zip.file(p); return f ? f.async('string') : ''; };

function resolve(base: string, target: string) {
  if (target.startsWith('/')) return target.slice(1);
  const parts = base.split('/'); parts.pop();
  for (const seg of target.split('/')) { if (seg === '..') parts.pop(); else if (seg !== '.') parts.push(seg); }
  return parts.join('/');
}

async function relsOf(zip: JSZip, path: string) {
  const dir = path.substring(0, path.lastIndexOf('/'));
  const name = path.substring(path.lastIndexOf('/') + 1);
  const x = await text(zip, `${dir}/_rels/${name}.rels`);
  const map = new Map<string, { type: string; target: string }>();
  if (!x) return map;
  for (const r of Array.from(parse(x).getElementsByTagName('Relationship'))) {
    map.set(r.getAttribute('Id')!, { type: r.getAttribute('Type') ?? '', target: resolve(path, r.getAttribute('Target') ?? '') });
  }
  return map;
}

// ---------- colours ----------
function themeColors(x: string): string[] {
  if (!x) return [];
  const d = parse(x);
  const scheme = d.getElementsByTagNameNS(A, 'clrScheme')[0];
  const order = ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
  return order.map((n) => {
    const e = kid(scheme, n);
    const c = e?.firstElementChild;
    return (c?.getAttribute('val') === 'windowText' ? '000000' : c?.getAttribute('val') === 'window' ? 'FFFFFF' : c?.getAttribute('lastClr') ?? c?.getAttribute('val') ?? '000000').replace('#', '');
  });
}
function tint(hex: string, t: number) {
  const n = parseInt(hex, 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(t < 0 ? v * (1 + t) : v + (255 - v) * t));
  return ch.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

// ---------- styles ----------
interface Edge { style: string; color: string }
interface Xf {
  numFmt: number; font: number; fill: number; border: number;
  h?: string; v?: string; wrap: boolean; rot: number; indent: number; shrink?: boolean;
}
interface Styles {
  fonts: { b: boolean; i: boolean; u: boolean; sz: number; color: string; name: string }[];
  fills: string[];
  borders: { l?: Edge; r?: Edge; t?: Edge; b?: Edge }[];
  xfs: Xf[];
  fmts: Map<number, string>;
}

function parseStyles(x: string, theme: string[]): Styles {
  const d = parse(x);
  const col = (e: Element | undefined, dflt = '000000'): string => {
    if (!e) return dflt;
    if (e.getAttribute('rgb')) return e.getAttribute('rgb')!.slice(-6);
    if (e.getAttribute('indexed') != null) return INDEXED[Number(e.getAttribute('indexed'))] ?? dflt;
    if (e.getAttribute('theme') != null) {
      const base = theme[Number(e.getAttribute('theme'))] ?? dflt;
      const t = Number(e.getAttribute('tint') ?? 0);
      return t ? tint(base, t) : base;
    }
    return dflt;
  };
  const root = d.documentElement;
  const fonts = kids(kid(root, 'fonts'), 'font').map((f) => ({
    b: !!kid(f, 'b'), i: !!kid(f, 'i'), u: !!kid(f, 'u'),
    sz: Number(kid(f, 'sz')?.getAttribute('val') ?? 11),
    color: col(kid(f, 'color')), name: kid(f, 'name')?.getAttribute('val') ?? 'Arial',
  }));
  const fills = kids(kid(root, 'fills'), 'fill').map((f) => {
    const p = kid(f, 'patternFill');
    if (!p || (p.getAttribute('patternType') ?? 'none') === 'none') return '';
    return '#' + col(kid(p, 'fgColor'), 'FFFFFF');
  });
  const edge = (b: Element, n: string): Edge | undefined => {
    const e = kid(b, n);
    const s = e?.getAttribute('style');
    return s ? { style: s, color: '#' + col(kid(e, 'color')) } : undefined;
  };
  const borders = kids(kid(root, 'borders'), 'border').map((b) => ({ l: edge(b, 'left'), r: edge(b, 'right'), t: edge(b, 'top'), b: edge(b, 'bottom') }));
  const fmts = new Map<number, string>();
  for (const n of kids(kid(root, 'numFmts'), 'numFmt')) fmts.set(Number(n.getAttribute('numFmtId')), n.getAttribute('formatCode') ?? '');
  const xfs = kids(kid(root, 'cellXfs'), 'xf').map((xf) => {
    const al = kid(xf, 'alignment');
    return {
      numFmt: Number(xf.getAttribute('numFmtId') ?? 0), font: Number(xf.getAttribute('fontId') ?? 0),
      fill: Number(xf.getAttribute('fillId') ?? 0), border: Number(xf.getAttribute('borderId') ?? 0),
      h: al?.getAttribute('horizontal') ?? undefined, v: al?.getAttribute('vertical') ?? undefined,
      wrap: al?.getAttribute('wrapText') === '1' || al?.getAttribute('wrapText') === 'true',
      rot: Number(al?.getAttribute('textRotation') ?? 0), indent: Number(al?.getAttribute('indent') ?? 0),
      shrink: al?.getAttribute('shrinkToFit') === '1' || al?.getAttribute('shrinkToFit') === 'true',
    } as Xf;
  });
  return { fonts, fills, borders, xfs, fmts };
}

const BORDER_CSS: Record<string, string> = {
  thin: '1px solid', hair: '1px solid', medium: '2px solid', thick: '3px solid', dotted: '1px dotted', dashed: '1px dashed',
  mediumDashed: '2px dashed', dashDot: '1px dashed', double: '3px double', slantDashDot: '2px dashed', mediumDashDot: '2px dashed',
};
const edgeCss = (side: string, e?: Edge) => (e ? `border-${side}:${BORDER_CSS[e.style] ?? '1px solid'} ${e.color};` : '');

// ---------- values ----------
function serialToDate(n: number) {
  const ms = Math.round((n - 25569) * 86400000);
  const d = new Date(ms);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatNumber(n: number, code: string | undefined, id: number): string {
  const isDate = (id >= 14 && id <= 22) || (id >= 45 && id <= 47) ||
    (code ? /[dmy]/i.test(code.replace(/"[^"]*"|\\.|\[[^\]]*\]/g, '')) && !/[#0]/.test(code.replace(/"[^"]*"|\\.|\[[^\]]*\]/g, '')) : false);
  if (isDate) {
    const { y, m, d } = serialToDate(n);
    const pad = (v: number) => String(v).padStart(2, '0');
    if (code && id >= 164) {
      return code.split(';')[0].replace(/"([^"]*)"|\\(.)|\[[^\]]*\]|_.|yyyy|yy|mmmm|mmm|mm|m|dd|d|@/gi, (tok: string, q?: string, esc?: string) => {
        if (q !== undefined) return q;
        if (esc !== undefined) return esc;
        const k = tok.toLowerCase();
        if (k === 'yyyy') return String(y);
        if (k === 'yy') return pad(y % 100);
        if (k === 'mmmm') return MONTHS[m - 1];
        if (k === 'mmm') return MONTHS[m - 1].slice(0, 3);
        if (k === 'mm') return pad(m);
        if (k === 'm') return String(m);
        if (k === 'dd') return pad(d);
        if (k === 'd') return String(d);
        return '';
      });
    }
    return `${pad(m)}/${pad(d)}/${y}`;
  }
  const dec = code ? (/\.(0+)/.exec(code)?.[1].length ?? 0) : id === 2 || id === 4 ? 2 : 0;
  if (code && /[#0]/.test(code) || id === 2 || id === 4 || id === 3) {
    const pct = code?.includes('%');
    const v = pct ? n * 100 : n;
    const s = v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: /,/.test(code ?? '') || id === 3 || id === 4 });
    return pct ? s + '%' : s;
  }
  return String(Math.round(n * 1e10) / 1e10);
}

// ---------- the main entry ----------
interface Cell { v: string; s: number; }

export async function renderPdsPages(buf: ArrayBuffer): Promise<PdsPage[]> {
  const zip = await JSZip.loadAsync(buf);
  const theme = themeColors(await text(zip, 'xl/theme/theme1.xml'));
  const st = parseStyles(await text(zip, 'xl/styles.xml'), theme);
  const sst: string[] = [];
  const sx = await text(zip, 'xl/sharedStrings.xml');
  if (sx) {
    for (const si of Array.from(parse(sx).getElementsByTagNameNS(MAIN, 'si'))) {
      let out = '';
      for (const t of Array.from(si.getElementsByTagNameNS(MAIN, 't'))) if (t.parentElement?.localName !== 'rPh') out += t.textContent ?? '';
      sst.push(out);
    }
  }

  const wb = parse(await text(zip, 'xl/workbook.xml'));
  const wbRels = await relsOf(zip, 'xl/workbook.xml');
  const sheets = Array.from(wb.getElementsByTagNameNS(MAIN, 'sheet')).map((s, i) => ({
    name: s.getAttribute('name')!, idx: i, path: wbRels.get(s.getAttributeNS(REL, 'id')!)?.target ?? '',
  }));
  const printAreas = new Map<number, string>();
  for (const dn of Array.from(wb.getElementsByTagNameNS(MAIN, 'definedName'))) {
    if (dn.getAttribute('name') === '_xlnm.Print_Area') printAreas.set(Number(dn.getAttribute('localSheetId')), dn.textContent ?? '');
  }

  const pages: PdsPage[] = [];
  for (const sh of sheets) {
    if (!sh.path || !zip.file(sh.path)) continue;
    const doc = parse(await text(zip, sh.path));
    const rels = await relsOf(zip, sh.path);
    const root = doc.documentElement;

    // grid geometry
    const fmt = kid(root, 'sheetFormatPr');
    const dCol = Number(fmt?.getAttribute('defaultColWidth') ?? 9.14);
    const dRow = Number(fmt?.getAttribute('defaultRowHeight') ?? 13.2);
    const colW = new Map<number, { w: number; hidden: boolean; style: number }>();
    for (const c of kids(kid(root, 'cols'), 'col')) {
      for (let i = Number(c.getAttribute('min')); i <= Number(c.getAttribute('max')); i++) {
        colW.set(i, { w: Number(c.getAttribute('width') ?? dCol), hidden: c.getAttribute('hidden') === '1', style: Number(c.getAttribute('style') ?? 0) });
      }
    }
    const pxCol = (i: number) => (colW.get(i)?.hidden ? 0 : Math.round(((colW.get(i)?.w ?? dCol) * 7 + 5)));

    // cells
    const rows = new Map<number, { ht: number; hidden: boolean; s: number; cells: Map<number, Cell> }>();
    let maxR = 1, maxC = 1;
    for (const r of Array.from(root.getElementsByTagNameNS(MAIN, 'row'))) {
      const rn = Number(r.getAttribute('r'));
      const row = { ht: Number(r.getAttribute('ht') ?? dRow), hidden: r.getAttribute('hidden') === '1', s: Number(r.getAttribute('s') ?? 0), cells: new Map<number, Cell>() };
      rows.set(rn, row);
      maxR = Math.max(maxR, rn);
      for (const c of kids(r, 'c')) {
        const m = /^([A-Z]+)(\d+)$/.exec(c.getAttribute('r')!);
        if (!m) continue;
        const cn = colNum(m[1]);
        const t = c.getAttribute('t');
        const raw = kid(c, 'v')?.textContent ?? '';
        const s = Number(c.getAttribute('s') ?? 0);
        let v = '';
        if (t === 's') v = sst[Number(raw)] ?? '';
        else if (t === 'inlineStr') v = Array.from(c.getElementsByTagNameNS(MAIN, 't')).map((x) => x.textContent).join('');
        else if (t === 'str' || t === 'e') v = raw;
        else if (t === 'b') v = raw === '1' ? 'TRUE' : 'FALSE';
        else if (raw !== '') { const xf = st.xfs[s]; v = formatNumber(Number(raw), xf ? st.fmts.get(xf.numFmt) : undefined, xf?.numFmt ?? 0); }
        row.cells.set(cn, { v, s });
        maxC = Math.max(maxC, cn);
      }
    }

    // merges
    const merges = new Map<string, { r2: number; c2: number }>();
    const covered = new Set<string>();
    for (const mc of Array.from(root.getElementsByTagNameNS(MAIN, 'mergeCell'))) {
      const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(mc.getAttribute('ref') ?? '');
      if (!m) continue;
      const c1 = colNum(m[1]), r1 = Number(m[2]), c2 = colNum(m[3]), r2 = Number(m[4]);
      merges.set(`${r1},${c1}`, { r2, c2 });
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) if (r !== r1 || c !== c1) covered.add(`${r},${c}`);
    }

    // print area + page breaks
    let c1 = 1, r1 = 1, c2 = maxC, r2 = maxR;
    const pa = /\$([A-Z]+)\$(\d+):\$([A-Z]+)\$(\d+)/.exec(printAreas.get(sh.idx) ?? '');
    if (pa) { c1 = colNum(pa[1]); r1 = Number(pa[2]); c2 = colNum(pa[3]); r2 = Number(pa[4]); }
    const breaks = kids(kid(root, 'rowBreaks'), 'brk').map((b) => Number(b.getAttribute('id'))).filter((b) => b >= r1 && b < r2).sort((a, b) => a - b);
    const ranges: [number, number][] = [];
    let start = r1;
    for (const b of breaks) { ranges.push([start, b]); start = b + 1; }
    ranges.push([start, r2]);

    // controls (tick boxes, drop-down) and text boxes, by cell anchors
    interface Over { col: number; colOff: number; row: number; rowOff: number; col2: number; colOff2: number; row2: number; rowOff2: number; html: string; label?: string; pic?: boolean }
    const overlays: Over[] = [];
    const vmlRel = Array.from(rels.values()).find((r) => r.type.endsWith('/vmlDrawing'));
    const vml = vmlRel ? await text(zip, vmlRel.target) : '';
    const vmlShapes = new Map<string, { label: string; checked: boolean }>();
    for (const m of vml.matchAll(/<v:shape\s[^>]*?(?:o:spid|id)="_x0000_s(\d+)"[\s\S]*?<\/v:shape>/g)) {
      const body = m[0];
      const label = (/<div[^>]*>([\s\S]*?)<\/div>/.exec(body)?.[1] ?? '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
      vmlShapes.set(m[1], { label, checked: /<x:Checked>1/.test(body) });
    }
    const dropText = (link: string, range: string, sel: number) => {
      const rm = /^\$?([A-Z]+)\$?(\d+)/.exec(range);
      if (!rm) return '';
      const cell = rows.get(Number(rm[2]) + sel - 1)?.cells.get(colNum(rm[1]));
      return cell?.v ?? '';
    };
    const seenLabels = new Set<string>();
    for (const ctl of Array.from(root.getElementsByTagNameNS(MAIN, 'control'))) {
      const rid = ctl.getAttributeNS(REL, 'id') ?? '';
      const target = rels.get(rid)?.target;
      const props = target ? parse(await text(zip, target)).documentElement : null;
      const an = ctl.getElementsByTagNameNS(MAIN, 'from')[0];
      const to = ctl.getElementsByTagNameNS(MAIN, 'to')[0];
      if (!props || !an || !to) continue;
      const g = (e: Element, n: string) => Number(e.getElementsByTagNameNS(XDR, n)[0]?.textContent ?? 0);
      const base = { col: g(an, 'col') + 1, colOff: g(an, 'colOff') / EMU, row: g(an, 'row') + 1, rowOff: g(an, 'rowOff') / EMU, col2: g(to, 'col') + 1, colOff2: g(to, 'colOff') / EMU, row2: g(to, 'row') + 1, rowOff2: g(to, 'rowOff') / EMU };
      const link = /^\$?([A-Z]+)\$?(\d+)$/.exec(props.getAttribute('fmlaLink') ?? '');
      if (link) { const lc = rows.get(Number(link[2]))?.cells.get(colNum(link[1])); if (lc) lc.v = ''; }
      const type = props.getAttribute('objectType');
      const shape = vmlShapes.get(ctl.getAttribute('shapeId') ?? '');
      if (type === 'CheckBox') {
        const label = shape?.label ?? '';
        seenLabels.add(label);
        const on = props.getAttribute('checked') === 'Checked' || props.getAttribute('checked') === '1';
        overlays.push({ ...base, label, html: `<span class="cb">${on ? '&#9745;' : '&#9744;'}</span><span class="cl">${esc(label)}</span>` });
      } else if (type === 'Drop') {
        const t = dropText(props.getAttribute('fmlaLink') ?? '', props.getAttribute('fmlaRange') ?? '', Number(props.getAttribute('sel') ?? 0));
        overlays.push({ ...base, html: `<span class="dd">${esc(t)}</span>` });
      }
    }
    const drRel = Array.from(rels.values()).find((r) => r.type.endsWith('/drawing'));
    if (drRel) {
      const dd = parse(await text(zip, drRel.target));
      const drRels = await relsOf(zip, drRel.target);
      for (const anc of Array.from(dd.documentElement.children)) {
        const sp = Array.from(anc.children).find((c) => c.localName === 'sp');
        const from = kid(anc, 'from'), to = kid(anc, 'to');
        const pic = Array.from(anc.children).find((c) => c.localName === 'pic');
        if (pic && from && to) {
          const blip = pic.getElementsByTagNameNS(A, 'blip')[0];
          const emb = blip?.getAttributeNS(REL, 'embed');
          const target = emb ? drRels.get(emb)?.target : '';
          const file = target ? zip.file(target) : null;
          if (file) {
            const b64 = await file.async('base64');
            const ext = (target ?? '').toLowerCase().endsWith('png') ? 'png' : 'jpeg';
            const gg = (e: Element, n: string) => Number(kid(e, n)?.textContent ?? 0);
            overlays.push({
              col: gg(from, 'col') + 1, colOff: gg(from, 'colOff') / EMU, row: gg(from, 'row') + 1, rowOff: gg(from, 'rowOff') / EMU,
              col2: gg(to, 'col') + 1, colOff2: gg(to, 'colOff') / EMU, row2: gg(to, 'row') + 1, rowOff2: gg(to, 'rowOff') / EMU,
              html: `<img src="data:image/${ext};base64,${b64}" style="width:100%;height:100%;object-fit:contain" alt="">`, pic: true,
            });
          }
          continue;
        }
        if (!sp || !from || !to) continue;
        const paras = Array.from(sp.getElementsByTagNameNS(A, 'p')).map((p) => Array.from(p.getElementsByTagNameNS(A, 't')).map((t) => t.textContent).join(''));
        const t = paras.join('\n').trim();
        if (!t || seenLabels.has(t.replace(/\s+/g, ' '))) continue;
        const run = sp.getElementsByTagNameNS(A, 'rPr')[0];
        const g = (e: Element, n: string) => Number(kid(e, n)?.textContent ?? 0);
        overlays.push({
          col: g(from, 'col') + 1, colOff: g(from, 'colOff') / EMU, row: g(from, 'row') + 1, rowOff: g(from, 'rowOff') / EMU,
          col2: g(to, 'col') + 1, colOff2: g(to, 'colOff') / EMU, row2: g(to, 'row') + 1, rowOff2: g(to, 'rowOff') / EMU,
          html: `<span class="tb" style="font-size:${(Number(run?.getAttribute('sz') ?? 1000) / 100) * 1.333}px;${run?.getAttribute('b') === '1' ? 'font-weight:700;' : ''}${run?.getAttribute('i') === '1' ? 'font-style:italic;' : ''}">${esc(t)}</span>`,
        });
      }
    }

    // build each page
    ranges.forEach(([ra, rb], pi) => {
      const widths: number[] = [];
      for (let c = c1; c <= c2; c++) widths.push(pxCol(c));
      const totalW = widths.reduce((a, b) => a + b, 0);
      const rowPx = (r: number) => (rows.get(r)?.hidden ? 0 : Math.round(((rows.get(r)?.ht ?? dRow) * 96) / 72 * 100) / 100);
      let totalH = 0;
      const tops = new Map<number, number>();
      for (let r = ra; r <= rb; r++) { tops.set(r, totalH); totalH += rowPx(r); }
      const lefts = new Map<number, number>();
      let acc = 0;
      for (let c = c1; c <= c2 + 1; c++) { lefts.set(c, acc); acc += pxCol(c); }

      const styleOf = (r: number, c: number) => rows.get(r)?.cells.get(c)?.s ?? (rows.get(r)?.s || (colW.get(c)?.style ?? 0));
      let html = `<table class="pt" style="width:${totalW}px"><colgroup>${widths.map((w) => `<col style="width:${w}px">`).join('')}</colgroup>`;
      for (let r = ra; r <= rb; r++) {
        const h = rowPx(r);
        if (h === 0) continue;
        html += `<tr style="height:${h}px">`;
        for (let c = c1; c <= c2; c++) {
          if (covered.has(`${r},${c}`)) continue;
          const mg = merges.get(`${r},${c}`);
          const cell = rows.get(r)?.cells.get(c);
          const xf = st.xfs[cell?.s ?? styleOf(r, c)] ?? st.xfs[0];
          const font = st.fonts[xf?.font ?? 0];
          // borders: take each outer edge from the matching corner cell of a merge
          const bTop = st.borders[st.xfs[styleOf(r, c)]?.border ?? 0]?.t;
          const bLeft = st.borders[st.xfs[styleOf(r, c)]?.border ?? 0]?.l;
          const rr = mg ? Math.min(mg.r2, rb) : r, cc = mg ? Math.min(mg.c2, c2) : c;
          const bRight = st.borders[st.xfs[styleOf(r, cc)]?.border ?? 0]?.r;
          const bBottom = st.borders[st.xfs[styleOf(rr, c)]?.border ?? 0]?.b;
          const fill = st.fills[xf?.fill ?? 0];
          const align = xf?.h === 'center' || xf?.h === 'centerContinuous' ? 'center' : xf?.h === 'right' ? 'right' : xf?.h === 'justify' ? 'justify' : 'left';
          const valign = xf?.v === 'top' ? 'top' : xf?.v === 'center' ? 'middle' : 'bottom';
          const rot = xf?.rot === 90 ? 'writing-mode:vertical-rl;transform:rotate(180deg);' : xf?.rot === 180 || xf?.rot === 255 ? 'writing-mode:vertical-rl;' : '';
          const css =
            `font:${font?.i ? 'italic ' : ''}${font?.b ? 'bold ' : ''}${((font?.sz ?? 10) * 96 / 72).toFixed(1)}px '${font?.name ?? 'Arial'}',Arial,sans-serif;` +
            `color:#${font?.color ?? '000000'};text-align:${align};vertical-align:${valign};` +
            (font?.u ? 'text-decoration:underline;' : '') + (fill ? `background:${fill};` : '') +
            edgeCss('top', bTop) + edgeCss('left', bLeft) + edgeCss('right', bRight) + edgeCss('bottom', bBottom) +
            (xf?.wrap ? 'white-space:pre-wrap;overflow:hidden;' : 'white-space:pre;') +
            (xf?.indent ? `padding-left:${xf.indent * 9}px;` : '');
          let shrinkCss = '';
          if (xf?.shrink && cell?.v) {
            let wpx = 0;
            for (let k = c; k <= (mg ? Math.min(mg.c2, c2) : c); k++) wpx += pxCol(k);
            const fontPx = ((font?.sz ?? 10) * 96) / 72;
            const fit = (wpx - 8) / (cell.v.length * 0.66);
            if (fit < fontPx) shrinkCss = `font-size:${Math.max(4, fit).toFixed(1)}px;`;
          }
          const span = mg ? ` colspan="${Math.min(mg.c2, c2) - c + 1}" rowspan="${Math.min(mg.r2, rb) - r + 1}"` : '';
          const v = cell?.v ?? '';
          html += `<td${span} style="${css}${shrinkCss}">${rot ? `<div style="${rot}">${esc(v)}</div>` : esc(v)}</td>`;
        }
        html += '</tr>';
      }
      html += '</table>';

      for (const o of overlays) {
        if (o.row < ra || o.row > rb || o.col < c1 || o.col > c2 + 1) continue;
        const x = (lefts.get(o.col) ?? 0) + o.colOff;
        const y = (tops.get(o.row) ?? 0) + o.rowOff;
        const x2 = (lefts.get(Math.min(o.col2, c2 + 1)) ?? totalW) + o.colOff2;
        if (o.pic) {
          const y2 = (tops.get(Math.min(o.row2, rb)) ?? totalH) + o.rowOff2;
          html += `<div class="ov" style="left:${x}px;top:${y}px;width:${Math.max(12, x2 - x)}px;height:${Math.max(12, y2 - y)}px">${o.html}</div>`;
          continue;
        }
        html += `<div class="ov" style="left:${x}px;top:${y}px;width:${Math.max(12, x2 - x)}px">${o.html}</div>`;
      }
      pages.push({
        title: ranges.length > 1 ? `${sh.name} · page ${pi + 1}` : sh.name,
        width: totalW, height: totalH,
        html: `<div class="pg" style="width:${totalW}px;height:${totalH}px">${html}</div>`,
      });
    });
  }
  return pages;
}

export const PDS_PAGE_CSS = `
.pg{position:relative;background:#fff;overflow:hidden}
.pt{border-collapse:collapse;table-layout:fixed;background:#fff}
.pt td{padding:0 2px;overflow:visible;line-height:1.15;box-sizing:border-box;max-width:0}
.ov{position:absolute;font:11px Arial,sans-serif;color:#000;white-space:nowrap;display:flex;align-items:center;gap:3px;pointer-events:none}
.ov .cb{font-size:15px;line-height:1}
.ov .dd{border:1px solid #777;background:#fff;padding:0 4px;width:100%;overflow:hidden}
.ov .tb{white-space:pre-wrap;font-family:Arial,sans-serif}
`;
