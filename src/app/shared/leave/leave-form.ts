import { LeaveView } from '../../core/services/leave.service';
import { blackenPng } from '../signature/blacken';
import { PdfPage, jpegBytes, pdfFromPages } from '../print/paper';
import { F6_FIELDS, F6_TICKS, Rect } from './form6-geo';

export const PAGE_W = 794, PAGE_H = 1123; // A4 at 96 dpi
export const SIG_FRAC = 0.17;              // a signature's default width, as a fraction of the page (fits the signing space); the signer can resize it
export const SIG_MIN = 0.07, SIG_MAX = 0.36;
// The form is drawn larger than the old one-page sheet (its back is now page 2), so it fills the page.
const S = 1.72, OX = -284.6, OY = 0.1;
const K = (PAGE_W / 595.3) * S;            // points -> page pixels
const FS = 0.575;                          // the Excel sheet is shrunk to fit the A4 page, and so are its fonts

// 6.A rows of the original form (the tick goes in the box beside the type of leave)
const ROW: Record<string, number> = {
  'Vacation Leave': 18, 'Mandatory/Forced Leave': 19, 'Sick Leave': 20, 'Maternity Leave': 21, 'Paternity Leave': 22, 'Special Privilege Leave': 23,
  'Solo Parent Leave': 24, 'Study Leave': 25, '10-Day VAWC Leave': 26, 'Rehabilitation Privilege': 27, 'Special Leave Benefits for Women': 28,
  'Special Emergency (Calamity) Leave': 29, 'Adoption Leave': 30, Others: 31,
};

const WORDS = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
const TENS = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
export function numWords(n: number): string {
  const w = (x: number): string => (x < 20 ? WORDS[x] : x < 100 ? TENS[Math.floor(x / 10)] + (x % 10 ? '-' + WORDS[x % 10] : '') : WORDS[Math.floor(x / 100)] + ' HUNDRED' + (x % 100 ? ' ' + w(x % 100) : ''));
  const whole = Math.floor(n), frac = Math.round((n - whole) * 100);
  return (whole ? w(whole) : frac ? '' : 'ZERO') + (frac === 50 ? (whole ? ' AND ' : '') + 'ONE-HALF' : frac ? ` AND ${frac}/100` : '');
}
export function dayWord(n: number) { return `${numWords(n)} (${n}) ${n === 1 ? 'DAY' : 'DAYS'}`; }

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function longDate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${MONTHS[+m[2] - 1]} ${+m[3]}, ${m[1]}` : iso || '';
}

// Puts text inside a cell of the original form (the cell's size comes from the template).
function put(page: HTMLElement, r: Rect, html: string, o: { size?: number; bold?: boolean; align?: 'left' | 'center' | 'right'; valign?: 'top' | 'middle' | 'bottom'; wrap?: boolean; italic?: boolean; spill?: boolean } = {}) {
  if (!html) return;
  const el = document.createElement('div');
  const v = o.valign ?? 'bottom';
  el.style.cssText = `position:absolute;left:${r[0] * K + OX}px;top:${r[1] * K + OY}px;width:${(r[2] - r[0]) * K}px;height:${(r[3] - r[1]) * K}px;display:flex;flex-direction:column;justify-content:${v === 'top' ? 'flex-start' : v === 'middle' ? 'center' : 'flex-end'};` +
    `text-align:${o.align ?? 'center'};font:${o.italic ? 'italic ' : ''}${o.bold ? '700' : '400'} ${(o.size ?? 9) * FS * K}px/1.15 Arial,'Liberation Sans',Helvetica,sans-serif;color:#000;overflow:${o.spill ? 'visible' : 'hidden'};padding:0 1px;${o.wrap ? '' : 'white-space:nowrap;'}`;
  el.innerHTML = html;
  page.appendChild(el);
}
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const tick = (page: HTMLElement, key: string) => put(page, F6_TICKS[key], '/', { size: 11, align: 'center', valign: 'middle' });
const num = (n: number | null | undefined) => (n == null ? '' : String(Math.round(n * 100) / 100));

// The Civil Service Form No. 6 (Revised 2020): your original form as the page, with the details written on it.
export async function buildForm6(v: LeaveView): Promise<HTMLElement> {
  const d = v.data;
  const page = document.createElement('div');
  page.className = 'pg f6';
  page.style.cssText = `position:relative;width:${PAGE_W}px;height:${PAGE_H}px;background:#fff;overflow:hidden;`;
  const bg = document.createElement('img');
  bg.src = '/form6-front.png'; bg.alt = ''; bg.style.cssText = `position:absolute;left:${OX}px;top:${OY}px;width:${PAGE_W * S}px;height:${PAGE_H * S}px;`;
  page.appendChild(bg);
  await bg.decode().catch(() => undefined);

  const f = F6_FIELDS;
  put(page, f['office'], esc(d.office), { size: 8, bold: true, align: 'left', spill: true });
  put(page, f['last'], esc(d.lastName), { bold: true }); put(page, f['first'], esc(d.firstName), { bold: true }); put(page, f['middle'], esc(d.middleName), { bold: true });
  put(page, f['filing'], esc(longDate(d.filingDate)), { bold: true });
  put(page, f['position'], esc(d.position), { bold: true }); put(page, f['salary'], esc(d.salary), { bold: true });

  // 6.A
  const row = ROW[d.leaveType];
  if (row) tick(page, 'c' + row);
  if (d.leaveType === 'Others') put(page, f['other'], esc(d.otherLeave.toUpperCase()), { size: 8, bold: true });
  // 6.B
  if (d.leaveType === 'Sick Leave') {
    if (d.illness === 'hospital') { tick(page, 'j22'); put(page, f['illHosp'], esc(d.illnessText), { size: 7, align: 'left' }); }
    if (d.illness === 'outpatient') { tick(page, 'j23'); put(page, f['illOut'], esc(d.illnessText), { size: 7, align: 'left' }); }
  }
  if (d.leaveType === 'Special Leave Benefits for Women') put(page, f['illWomen'], esc(d.womenText), { size: 7, align: 'left' });
  if (d.leaveType === 'Study Leave') { if (d.study === 'masters') tick(page, 'j27'); if (d.study === 'bar') tick(page, 'j28'); }
  if (d.monetization === 'monetization') tick(page, 'j30');
  if (d.monetization === 'terminal') tick(page, 'j31');
  // 6.C
  put(page, f['days'], esc(dayWord(d.days)), { bold: true }); put(page, f['dates'], esc(d.dates.toUpperCase()), { bold: true });

  // 7.A (filled from the credits when the AO approves; nobody types it)
  const c = v.credit;
  if (c) {
    put(page, f['asOf'], esc(longDate(c.asOf)), { size: 8 });
    if (c.vl) { put(page, f['vlEarned'], num(c.vl.earned), { size: 10, valign: 'middle' }); put(page, f['vlLess'], num(c.vl.less), { size: 10, valign: 'middle' }); put(page, f['vlBal'], num(c.vl.balance), { size: 10, valign: 'middle' }); }
    if (c.sl) { put(page, f['slEarned'], num(c.sl.earned), { size: 10, valign: 'middle' }); put(page, f['slLess'], num(c.sl.less), { size: 10, valign: 'middle' }); put(page, f['slBal'], num(c.sl.balance), { size: 10, valign: 'middle' }); }
  }
  put(page, f['hrmo'], `<b style="font-size:${10 * FS * K}px">${esc(v.printed.hrmo)}</b>${v.printed.hrmoTitle ? `<i>${esc(v.printed.hrmoTitle)}</i>` : ''}`, { size: 8 });
  // 7.B
  const rec = v.recommendation;
  if (rec?.decision === 'approval') tick(page, 'j45');
  if (rec?.decision === 'disapproval') { tick(page, 'j46'); put(page, f['recReason'], esc(rec.reason), { size: 7, align: 'left', valign: 'top', wrap: true }); }
  // the corresponding signatory's name is filled in automatically (School Head for teachers, staff and the AO; the District Supervisor for a School Head)
  put(page, f['sigName'], esc(v.printed.signatory.toUpperCase()), { size: 9, bold: true });
  // under the name: who signs (the template's "(Corresponding Signatory) School Head/ District Supervisor" is cleared from the picture)
  const t = document.createElement('div');
  t.textContent = v.printed.signatoryTitle;
  t.style.cssText = `position:absolute;left:${491.6}px;top:${882}px;width:${251.8}px;text-align:center;font:italic 700 ${11 * FS * K}px/1.15 Arial,'Liberation Sans',Helvetica,sans-serif;color:#000;`;
  page.appendChild(t);
  // 7.C / 7.D
  if (v.status === 'approved') put(page, f['daysPay'], esc(num(d.days)), { size: 9, bold: true });
  if (v.status === 'disapproved') put(page, f['disReason'], esc(v.note ?? ''), { size: 8, align: 'left', valign: 'top', wrap: true });
  put(page, f['asds'], `<b>${esc(v.printed.asds)}</b>${v.printed.asdsTitle ? `<span style="font-size:${8 * FS * K}px">${esc(v.printed.asdsTitle)}</span>` : ''}`, { size: 9 });

  const add = async (s: { img: string; x: number; y: number; w?: number } | undefined) => {
    if (!s) return;
    const el = document.createElement('img');
    el.className = 'tasig'; el.src = await blackenPng(s.img);
    el.style.cssText = `position:absolute;transform:translate(-50%,-50%);pointer-events:none;left:${s.x * 100}%;top:${s.y * 100}%;width:${(s.w ?? SIG_FRAC) * PAGE_W}px;`;
    page.appendChild(el);
  };
  await add(v.sigs.applicant); await add(v.sigs.signatory);
  return page;
}

// Page 2: the back of the form (Instructions and Requirements).
export async function buildForm6Back(): Promise<HTMLElement> {
  const page = document.createElement('div');
  page.className = 'pg f6back';
  page.style.cssText = `position:relative;width:${PAGE_W}px;height:${PAGE_H}px;background:#fff;overflow:hidden;`;
  const bg = document.createElement('img');
  bg.src = '/form6-back.png'; bg.alt = '';
  const m = 38; // side margin, px
  bg.style.cssText = `position:absolute;left:${m}px;top:${m}px;width:${PAGE_W - 2 * m}px;`;
  page.appendChild(bg);
  await bg.decode().catch(() => undefined);
  // the footnote, whole (the original cell is cut off at its second line)
  const note = document.createElement('div');
  note.style.cssText = `position:absolute;left:${m + 8}px;top:${m + 747}px;width:${PAGE_W - 2 * m - 16}px;font:400 9.6px/1.25 Arial,'Liberation Sans',Helvetica,sans-serif;color:#000;`;
  note.textContent = '* For leave of absence for thirty (30) calendar days or more and terminal leave, application shall be accompanied by a clearance from money, property and work-related accountabilities (pursuant to CSC Memorandum Circular No. 2, s. 1985).';
  page.appendChild(note);
  return page;
}

// Form 6 as a two-page PDF (front, then the back with the instructions) on the chosen paper.
export async function form6Pdf(pages: HTMLElement[], paper: { w: number; h: number } = { w: 595.28, h: 841.89 }): Promise<Blob> {
  const html2canvas = (await import('html2canvas')).default;
  const out: PdfPage[] = [];
  for (const el of pages) {
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false, ignoreElements: (e) => e.classList.contains('ghost') });
    out.push({ jpeg: jpegBytes(canvas), w: canvas.width, h: canvas.height, wPt: 595.28, hPt: 841.89 });
  }
  return pdfFromPages(out, paper);
}

export function suggestKind(type: string, kinds: string[]): string {
  const pick = (...k: string[]) => k.find((x) => kinds.includes(x)) ?? '';
  if (type === 'Special Privilege Leave') return pick('spl');
  if (type === 'Mandatory/Forced Leave') return pick('fl');
  if (type === 'Vacation Leave') return pick('vl', 'service_credit');
  if (type === 'Sick Leave') return pick('sl', 'service_credit');
  if (type === 'Others') return pick('wellness');
  return '';
}
