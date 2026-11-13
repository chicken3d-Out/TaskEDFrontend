import { DriveUploadService } from '../../core/services/drive-upload.service';
import { TaRecord, TravelAuthorityService } from '../../core/services/travel-authority.service';
import { taData, buildPdf } from './ta-pdf';
export { taData };
import { TaPackage, buildTa, emptyTa, openTa } from './ta-engine';
import { firstValueFrom } from 'rxjs';

export async function openTemplate(): Promise<TaPackage> {
  const { TEMPLATE_B64 } = await import('./ta-template');
  const bin = atob(TEMPLATE_B64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return openTa(bytes.buffer);
}

// The Word file for a record. Signatures are included unless `withSigs` is false.
export async function recordToDocx(rec: TaRecord, withSigs = true, pkg?: TaPackage, images = true): Promise<Blob> {
  const p = pkg ?? (await openTemplate());
  return buildTa(p, taData(rec), withSigs ? rec.sigs : undefined, images);
}

export function fileLabel(rec: TaRecord): string {
  const tail = (rec.data.dates || rec.data.destination || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50);
  const who = rec.data.name ? ` - ${rec.data.name.replace(/[\\/:*?"<>|]+/g, ' ')}` : '';
  return `Travel Authority${who}${tail ? ' - ' + tail : ''}`;
}

export function monthKey(rec: TaRecord): string {
  const d = rec.data.dateFrom || rec.createdAt;
  return String(d).slice(0, 7);
}

// Keeps ONE Word file in the owner's Drive: the first save creates it, every later
// change (a new edit or a new signature) replaces its contents.
export async function syncToDrive(drive: DriveUploadService, api: TravelAuthorityService, email: string | null | undefined, rec: TaRecord): Promise<TaRecord> {
  const full = rec.sigs ? rec : await firstValueFrom(api.get(rec.id));
  const token = await drive.accessToken(email);
  const blob = await buildPdf(full, await openTemplate()); // a fixed PDF: the layout can never move
  let link = full.driveLink;
  const id = link ? DriveUploadService.fileId(link) : null;
  let done = false;
  if (id) {
    try { await drive.replaceContent(token, id, blob); done = true; await drive.rename(token, id, `${fileLabel(full)}.pdf`).catch(() => {}); } catch { done = false; }
  }
  if (!done) {
    const parent = await drive.ensurePath(token, ['Working Directory', 'Travel Authority']);
    const up = await drive.upload(token, parent, new File([blob], `${fileLabel(full)}.pdf`, { type: 'application/pdf' }), () => {});
    link = up.link;
  }
  await firstValueFrom(api.setDrive(full.id, link ?? '', full.rev));
  return { ...full, driveLink: link, driveRev: full.rev, needsDriveSync: false };
}

export function hasDriveToken(): boolean {
  try {
    const raw = localStorage.getItem('tasked_drive_token');
    if (!raw) return false;
    const t = JSON.parse(raw);
    return !!t?.value && t.until > Date.now() + 60_000;
  } catch { return false; }
}
