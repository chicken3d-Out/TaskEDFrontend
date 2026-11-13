import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { DriveUploadService } from '../../core/services/drive-upload.service';
import { TaRecord, TravelAuthorityService } from '../../core/services/travel-authority.service';
import { fileLabel, openTemplate } from './ta-doc';
import { buildPdf } from './ta-pdf';
import { TRAVEL_MAILBOX, sendViaGmail } from './ta-mail';

// The applicant emails the e-signed Travel Authority (and attachments) to the Travel Authority
// mailbox, FROM THEIR OWN DepEd email, for the Schools Division Superintendent. Call it straight
// from a click: Google's permission window must open from the click.
export async function sendToTravelMailbox(drive: DriveUploadService, api: TravelAuthorityService, auth: AuthService, rec: TaRecord): Promise<void> {
  const user = auth.currentUser();
  if (!user?.depedEmail) throw new Error('Your DepEd email is not set in your profile.');
  const gtoken = await drive.gmailToken(user.depedEmail);
  const full = await firstValueFrom(api.get(rec.id));
  const signed = new Uint8Array(await (await buildPdf(full, await openTemplate())).arrayBuffer());
  const files = [{ filename: `${fileLabel(full)}.pdf`, mime: 'application/pdf', bytes: signed }];
  for (const a of full.attachments ?? []) {
    const got = await firstValueFrom(api.getAttachment(full.id, a.id));
    files.push({ filename: got.name, mime: got.mime, bytes: Uint8Array.from(atob(got.data), (c) => c.charCodeAt(0)) });
  }
  const d = full.data;
  const text = [
    'Good day.', '',
    'Please find the e-signed Travel Authority for the approval of the Schools Division Superintendent.', '',
    `Name: ${d.name}`, `Position: ${d.position}`, `Destination: ${d.destination}`, `Inclusive dates: ${d.dates}`, `Purpose: ${d.purpose}`, `Host of activity: ${d.host}`, `Fund source: ${d.fund}`, '',
    `E-signed by: ${full.requesterName} (requesting employee)${full.sigs?.countersign ? `, ${full.countersignName} (School Head, countersigned)` : ''}, ${full.recommendingName} (recommending authority).`,
    `Approving authority: ${full.approvingName}`,
    full.attachments?.length ? `Attachments: ${full.attachments.map((x) => x.name).join(', ')}` : 'No attachments.', '',
    'Sent through TaskEd, Schools Division of Leyte.',
  ].join('\r\n');
  await sendViaGmail(gtoken, { from: `${user.name ?? ''} <${user.depedEmail}>`, to: TRAVEL_MAILBOX, subject: `Travel Authority - ${d.name} - ${d.destination}`, text, files });
  await firstValueFrom(api.markEmailed(full.id));
}
