import { DriveUploadService } from '../../core/services/drive-upload.service';
import { TaRecord, TravelAuthorityService } from '../../core/services/travel-authority.service';
import { TEMPLATE_URL, TaPackage, buildTa, emptyTa, openTa } from './ta-engine';
import { firstValueFrom } from 'rxjs';

export async function openTemplate(): Promise<TaPackage> {
  const r = await fetch(TEMPLATE_URL);
  if (!r.ok) throw new Error('Could not load the blank Travel Authority form.');
  return openTa(await r.arrayBuffer());
}

export function taData(rec: TaRecord) {
  return { ...emptyTa(), name: rec.data.name, position: rec.data.position, station: rec.data.station, purpose: rec.data.purpose, host: rec.data.host, dates: rec.data.dates, destination: rec.data.destination, fund: rec.data.fund, recommending: rec.recommendingName, approving: rec.approvingName };
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
  const blob = await recordToDocx(full);
  let link = full.driveLink;
  const id = link ? DriveUploadService.fileId(link) : null;
  let done = false;
  if (id) {
    try { await drive.replaceContent(token, id, blob); done = true; } catch { done = false; }
  }
  if (!done) {
    const parent = await drive.ensurePath(token, ['Working Directory', 'Travel Authority']);
    const up = await drive.upload(token, parent, new File([blob], `${fileLabel(full)}.docx`, { type: blob.type }), () => {});
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
