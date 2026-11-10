import { DriveUploadService } from '../../core/services/drive-upload.service';
import { buildPds, openPds, readPds } from './pds-engine';
import { buildSaln, openSaln, readSaln } from '../saln/saln-engine';

// Downloads a file from the person's Drive. A PDS is re-saved first so the
// date accomplished on every page is today's date.
export async function downloadDriveFile(drive: DriveUploadService, token: string, link: string, label: string, kind: boolean | 'pds' | 'saln'): Promise<void> {
  const id = DriveUploadService.fileId(link);
  if (!id) throw new Error('This entry has no Google Drive file.');
  const buf = await drive.download(token, id);
  if (kind === 'saln') {
    let blob: Blob | null = null;
    try { const pkg = await openSaln(buf); blob = await buildSaln(pkg, readSaln(pkg)); } catch { blob = null; }
    if (blob) DriveUploadService.saveBlob(blob, `${label.replace(/\.docx$/i, '')}.docx`);
    else DriveUploadService.saveBlob(new Blob([buf]), await drive.fileName(token, id));
  } else if (kind === true || kind === 'pds') {
    const pkg = await openPds(buf);
    const blob = await buildPds(pkg, readPds(pkg));
    DriveUploadService.saveBlob(blob, `${label.replace(/\.xlsx$/i, '')}.xlsx`);
  } else {
    const name = await drive.fileName(token, id);
    DriveUploadService.saveBlob(new Blob([buf]), name);
  }
}
