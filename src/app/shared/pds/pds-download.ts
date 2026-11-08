import { DriveUploadService } from '../../core/services/drive-upload.service';
import { buildPds, openPds, readPds } from './pds-engine';

// Downloads a file from the person's Drive. A PDS is re-saved first so the
// date accomplished on every page is today's date.
export async function downloadDriveFile(drive: DriveUploadService, token: string, link: string, label: string, isPds: boolean): Promise<void> {
  const id = DriveUploadService.fileId(link);
  if (!id) throw new Error('This entry has no Google Drive file.');
  const buf = await drive.download(token, id);
  if (isPds) {
    const pkg = await openPds(buf);
    const blob = await buildPds(pkg, readPds(pkg));
    DriveUploadService.saveBlob(blob, `${label.replace(/\.xlsx$/i, '')}.xlsx`);
  } else {
    const name = await drive.fileName(token, id);
    DriveUploadService.saveBlob(new Blob([buf]), name);
  }
}
