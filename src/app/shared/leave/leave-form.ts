import { LeaveData, LeaveView } from '../../core/services/leave.service';
import { blackenPng } from '../signature/blacken';
import { pdfFromJpeg } from '../travel-authority/ta-pdf';

export const PAGE_W = 794, PAGE_H = 1123; // A4 at 96 dpi
export const SIG_W = 120;                  // signature width on the page, px

const TYPES: { t: string; label: string; law?: string }[] = [
  { t: 'Vacation Leave', label: 'Vacation Leave', law: '(Sec. 51, Rule XVI, Omnibus Rules Implementing E.O. No. 292)' },
  { t: 'Mandatory/Forced Leave', label: 'Mandatory/Forced Leave', law: '(Sec. 25, Rule XVI, Omnibus Rules Implementing E.O. No. 292)' },
  { t: 'Sick Leave', label: 'Sick Leave', law: '(Sec. 43, Rule XVI, Omnibus Rules Implementing E.O. No. 292)' },
  { t: 'Maternity Leave', label: 'Maternity Leave', law: '(R.A. No. 11210 / IRR issued by CSC, DOLE and SSS)' },
  { t: 'Paternity Leave', label: 'Paternity Leave', law: '(R.A. No. 8187 / CSC MC No. 71, s. 1998, as amended)' },
  { t: 'Special Privilege Leave', label: 'Special Privilege Leave', law: '(Sec. 21, Rule XVI, Omnibus Rules Implementing E.O. No. 292)' },
  { t: 'Solo Parent Leave', label: 'Solo Parent Leave', law: '(RA No. 8972 / CSC MC No. 8, s. 2004)' },
  { t: 'Study Leave', label: 'Study Leave', law: '(Sec. 68, Rule XVI, Omnibus Rules Implementing E.O. No. 292)' },
  { t: '10-Day VAWC Leave', label: '10-Day VAWC Leave', law: '(RA No. 9262 / CSC MC No. 15, s. 2005)' },
  { t: 'Rehabilitation Privilege', label: 'Rehabilitation Privilege', law: '(Sec. 55, Rule XVI, Omnibus Rules Implementing E.O. No. 292)' },
  { t: 'Special Leave Benefits for Women', label: 'Special Leave Benefits for Women', law: '(RA No. 9710 / CSC MC No. 25, s. 2010)' },
  { t: 'Special Emergency (Calamity) Leave', label: 'Special Emergency (Calamity) Leave', law: '(CSC MC No. 2, s. 2012, as amended)' },
  { t: 'Adoption Leave', label: 'Adoption Leave', law: '(R.A. No. 8552)' },
];

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const chk = (on: boolean) => `<span class="bx">${on ? '✓' : ''}</span>`;
const WORDS = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
const TENS = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
export function numWords(n: number): string {
  const w = (x: number): string => (x < 20 ? WORDS[x] : x < 100 ? TENS[Math.floor(x / 10)] + (x % 10 ? '-' + WORDS[x % 10] : '') : WORDS[Math.floor(x / 100)] + ' HUNDRED' + (x % 100 ? ' ' + w(x % 100) : ''));
  const whole = Math.floor(n), frac = Math.round((n - whole) * 100);
  return (whole ? w(whole) : frac ? '' : 'ZERO') + (frac === 50 ? (whole ? ' AND ' : '') + 'ONE-HALF' : frac ? ` AND ${frac}/100` : '');
}
export function dayWord(n: number) { return `${numWords(n)} (${n}) ${n === 1 ? 'DAY' : 'DAYS'}`; }

const CSS = `
.f6{box-sizing:border-box;width:${PAGE_W}px;height:${PAGE_H}px;background:#fff;color:#000;font:10px/1.25 Arial,Helvetica,sans-serif;padding:24px 28px;position:relative;overflow:hidden}
.f6 *{box-sizing:border-box} .f6 table{border-collapse:collapse;width:100%} .f6 td{border:1px solid #000;padding:3px 5px;vertical-align:top}
.f6 .top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;font-size:9px}
.f6 .ttl{text-align:center;font-weight:700;font-size:15px;margin:4px 0 6px;letter-spacing:.5px}
.f6 .c{text-align:center} .f6 .b{font-weight:700} .f6 .sm{font-size:8px} .f6 .it{font-style:italic}
.f6 .bx{display:inline-block;width:11px;height:11px;border:1px solid #000;text-align:center;line-height:9px;font-size:10px;font-weight:700;margin-right:4px;vertical-align:middle}
.f6 .ul{display:inline-block;border-bottom:1px solid #000;min-width:90px;padding:0 3px;font-weight:700}
.f6 .grey{background:#d9d9d9;font-weight:700;text-align:center}
.f6 .val{font-weight:700;font-size:11px;text-transform:uppercase}
.f6 .sigline{border-top:1px solid #000;text-align:center;margin-top:28px;padding-top:2px}
.f6 .tasig{position:absolute;transform:translate(-50%,-50%);pointer-events:none}
.f6 .tasig.ghost{opacity:.75;outline:1px dashed #16a34a}
.f6 ul{margin:2px 0 0;padding-left:14px} .f6 .inst{font-size:7.5px;line-height:1.2}
`;

function typeRows(d: LeaveData) {
  const rows = TYPES.map((x) => `<div>${chk(d.leaveType === x.t)}${esc(x.label)} <span class="sm it">${esc(x.law ?? '')}</span></div>`).join('');
  return rows + `<div>${chk(d.leaveType === 'Others')}Others: <span class="ul">${d.leaveType === 'Others' ? esc(d.otherLeave) : '&nbsp;'}</span></div>`;
}

function details(d: LeaveData) {
  const t = d.leaveType;
  const vac = t === 'Vacation Leave' || t === 'Special Privilege Leave';
  const sick = t === 'Sick Leave';
  return `
   <div class="b">In case of Vacation/Special Privilege Leave:</div>
   <div>${chk(vac && d.where === 'ph')}Within the Philippines <span class="ul">${vac && d.where === 'ph' ? esc(d.whereText) : '&nbsp;'}</span></div>
   <div>${chk(vac && d.where === 'abroad')}Abroad (Specify) <span class="ul">${vac && d.where === 'abroad' ? esc(d.whereText) : '&nbsp;'}</span></div>
   <div class="b" style="margin-top:5px">In case of Sick Leave:</div>
   <div>${chk(sick && d.illness === 'hospital')}In Hospital (Specify Illness) <span class="ul">${sick && d.illness === 'hospital' ? esc(d.illnessText) : '&nbsp;'}</span></div>
   <div>${chk(sick && d.illness === 'outpatient')}Out Patient (Specify Illness) <span class="ul">${sick && d.illness === 'outpatient' ? esc(d.illnessText) : '&nbsp;'}</span></div>
   <div class="b" style="margin-top:5px">In case of Special Leave Benefits for Women:</div>
   <div>(Specify Illness) <span class="ul">${t === 'Special Leave Benefits for Women' ? esc(d.womenText) : '&nbsp;'}</span></div>
   <div class="b" style="margin-top:5px">In case of Study Leave:</div>
   <div>${chk(t === 'Study Leave' && d.study === 'masters')}Completion of Master's Degree</div>
   <div>${chk(t === 'Study Leave' && d.study === 'bar')}BAR/Board Examination Review</div>
   <div class="b" style="margin-top:5px">Other purpose:</div>
   <div>${chk(d.monetization === 'monetization')}Monetization of Leave Credits</div>
   <div>${chk(d.monetization === 'terminal')}Terminal Leave</div>`;
}

// The Civil Service Form No. 6 (Revised 2020), laid out on one fixed A4 page. Signatures are added on top.
export async function buildForm6(v: LeaveView): Promise<HTMLElement> {
  const d = v.data, c = v.credit;
  const hasCredit = !!v.kindLabel;
  const page = document.createElement('div');
  page.className = 'pg f6';
  const sg = v.recommendation;
  page.innerHTML = `<style>${CSS}</style>
  <div class="top"><div class="b">Civil Service Form No. 6<br/>Revised 2020</div><div class="c b" style="border:1px solid #000;padding:2px 8px">ANNEX A</div></div>
  <div class="c" style="font-size:9px">Republic of the Philippines<br/><span class="b">DEPARTMENT OF EDUCATION</span></div>
  <div class="ttl">APPLICATION FOR LEAVE</div>
  <table>
   <tr><td style="width:46%">1. OFFICE/DEPARTMENT<br/><span class="val">${esc(d.office)}</span></td><td colspan="2">2. NAME : (Last) &nbsp;&nbsp;&nbsp;&nbsp; (First) &nbsp;&nbsp;&nbsp;&nbsp; (Middle)<br/><span class="val">${esc(d.lastName)} &nbsp; ${esc(d.firstName)} &nbsp; ${esc(d.middleName)}</span></td></tr>
   <tr><td>3. DATE OF FILING &nbsp;<span class="val">${esc(d.filingDate)}</span></td><td style="width:30%">4. POSITION &nbsp;<span class="val">${esc(d.position)}</span></td><td>5. SALARY &nbsp;<span class="val">${esc(d.salary)}</span></td></tr>
   <tr><td colspan="3" class="grey">6. DETAILS OF APPLICATION</td></tr>
   <tr><td colspan="2" style="width:54%"><div class="b">6.A TYPE OF LEAVE TO BE AVAILED OF</div>${typeRows(d)}</td><td><div class="b">6.B DETAILS OF LEAVE</div>${details(d)}</td></tr>
   <tr><td colspan="2"><div class="b">6.C NUMBER OF WORKING DAYS APPLIED FOR</div><div class="val" style="margin:3px 0 6px">${esc(dayWord(d.days))}</div><div class="b">INCLUSIVE DATES</div><div class="val" style="margin-top:3px">${esc(d.dates)}</div></td>
       <td><div class="b">6.D COMMUTATION</div><div>${chk(d.commutation === 'not')}Not Requested</div><div>${chk(d.commutation === 'requested')}Requested</div><div class="sigline" style="margin-top:34px">(Signature of Applicant)</div></td></tr>
   <tr><td colspan="3" class="grey">7. DETAILS OF ACTION ON APPLICATION</td></tr>
   <tr><td colspan="2"><div class="b">7.A CERTIFICATION OF LEAVE CREDITS</div><div style="margin:3px 0">As of &nbsp;<span class="ul">${c ? esc(c.asOf) : '&nbsp;'}</span></div>
     <table style="margin:4px 0"><tr><td class="c b"></td><td class="c b">${hasCredit ? esc(v.kindLabel) : '&nbsp;'}</td></tr>
      <tr><td>Total Earned</td><td class="c">${c ? esc(c.earned) : ''}</td></tr><tr><td>Less this application</td><td class="c">${c ? esc(c.less) : ''}</td></tr><tr><td class="b">Balance</td><td class="c b">${c ? esc(c.balance) : ''}</td></tr></table>
     <div class="sigline c" style="margin-top:22px"><span class="b">${esc(v.printed.hrmo)}</span><br/>Authorized Officer (HRMO II)</div></td>
     <td><div class="b">7.B RECOMMENDATION</div>
      <div>${chk(sg?.decision === 'approval')}For approval</div><div>${chk(sg?.decision === 'disapproval')}For disapproval due to <span class="ul" style="min-width:60px">${sg?.decision === 'disapproval' ? esc(sg.reason) : '&nbsp;'}</span></div>
      <div class="sigline c" style="margin-top:46px"><span class="b">${esc(v.printed.signatory)}</span><br/>${esc(v.printed.signatoryTitle)}</div></td></tr>
   <tr><td colspan="2"><div class="b">7.C APPROVED FOR:</div>
      <div><span class="ul" style="min-width:40px">${v.status === 'approved' && d.days ? esc(v.deducted || !hasCredit ? d.days : d.days) : '&nbsp;'}</span> days with pay</div><div><span class="ul" style="min-width:40px">&nbsp;</span> days without pay</div><div><span class="ul" style="min-width:40px">&nbsp;</span> others (Specify)</div></td>
     <td><div class="b">7.D DISAPPROVED DUE TO:</div><div style="min-height:40px">${v.status === 'disapproved' ? esc(v.note ?? '') : ''}</div></td></tr>
   <tr><td colspan="3" class="c" style="padding-top:26px"><span class="b">${esc(v.printed.asds)}</span><br/>Assistant Schools Division Superintendent<br/><span class="sm">Authorized Officer</span></td></tr>
  </table>
  <div class="inst" style="margin-top:6px"><div class="b">INSTRUCTIONS AND REQUIREMENTS</div>Application for any type of leave shall be made on this Form, accomplished at least in duplicate, with the documentary requirements. For the full instructions per type of leave, see CSC Form No. 6 (Revised 2020). Leave of thirty (30) calendar days or more, and terminal leave, must be accompanied by a clearance from money, property and work-related accountabilities (CSC MC No. 2, s. 1985).</div>`;
  const add = async (s: { img: string; x: number; y: number } | undefined) => {
    if (!s) return;
    const el = document.createElement('img');
    el.className = 'tasig'; el.src = await blackenPng(s.img);
    el.style.left = `${s.x * 100}%`; el.style.top = `${s.y * 100}%`; el.style.width = `${SIG_W}px`;
    page.appendChild(el);
  };
  await add(v.sigs.applicant); await add(v.sigs.ao); await add(v.sigs.signatory);
  return page;
}

export async function form6Pdf(page: HTMLElement): Promise<Blob> {
  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(page, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false, ignoreElements: (e) => e.classList.contains('ghost') });
  const jpeg = Uint8Array.from(atob(canvas.toDataURL('image/jpeg', 0.93).split(',')[1]), (c) => c.charCodeAt(0));
  return pdfFromJpeg(jpeg, canvas.width, canvas.height, 595.28, 841.89);
}

export function suggestKind(type: string, kinds: string[]): string {
  const pick = (...k: string[]) => k.find((x) => kinds.includes(x)) ?? '';
  if (type === 'Special Privilege Leave') return pick('spl');
  if (type === 'Mandatory/Forced Leave') return pick('fl');
  if (type === 'Vacation Leave' || type === 'Sick Leave') return pick('vl_sl', 'service_credit');
  if (type === 'Others') return pick('wellness');
  return '';
}
