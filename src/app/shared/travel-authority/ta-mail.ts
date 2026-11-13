export interface MailFile { filename: string; mime: string; bytes: Uint8Array }

export const TRAVEL_MAILBOX = 'travel.authority@deped.gov.ph';

function b64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const wrap = (s: string) => s.replace(/(.{76})/g, '$1\r\n');
const utf8 = (s: string) => new TextEncoder().encode(s);
const header = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(utf8(s))}?=`);

// Sends one email from the signed-in person's own Gmail / Google Workspace mailbox, using the
// Gmail API straight from the browser. The message is built here; TaskEd's server never sees it.
export async function sendViaGmail(token: string, m: { from: string; to: string; subject: string; text: string; files: MailFile[] }): Promise<void> {
  const boundary = 'tasked_' + Math.random().toString(36).slice(2);
  const lines: string[] = [
    `From: ${m.from}`,
    `To: ${m.to}`,
    `Subject: ${header(m.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrap(b64(utf8(m.text))),
  ];
  for (const f of m.files) {
    lines.push(
      `--${boundary}`,
      `Content-Type: ${f.mime || 'application/octet-stream'}; name="${header(f.filename)}"`,
      `Content-Disposition: attachment; filename="${header(f.filename)}"`,
      'Content-Transfer-Encoding: base64',
      '',
      wrap(b64(f.bytes)),
    );
  }
  lines.push(`--${boundary}--`, '');
  const res = await fetch('https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=media', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'message/rfc822' },
    body: lines.join('\r\n'),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(res.status === 403 ? 'Google did not allow sending the email. The Gmail API may not be enabled for TaskEd yet. Ask the Administrator.' : `The email could not be sent (${res.status}). ${t.slice(0, 120)}`);
  }
}
