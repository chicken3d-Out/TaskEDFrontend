import { firstValueFrom } from 'rxjs';
import { TaAttachment, TravelAuthorityService } from '../../core/services/travel-authority.service';

export const TA_ATTACH_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
export const TA_ATTACH_MAX = 4 * 1024 * 1024;

// Send an attachment straight to Cloudinary (it never passes through our server), then
// tell TaskEd where it is.
export async function uploadTaAttachment(api: TravelAuthorityService, taId: string, file: File): Promise<TaAttachment[]> {
  const signed = await firstValueFrom(api.uploadSignature());
  const form = new FormData();
  for (const [k, v] of Object.entries(signed.fields)) form.append(k, v);
  form.append('file', file, file.name);
  const res = await fetch(signed.uploadUrl, { method: 'POST', body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.secure_url) throw new Error(body?.error?.message ?? `Upload failed (${res.status})`);
  return firstValueFrom(api.addAttachment(taId, { name: file.name, mime: file.type || 'application/octet-stream', size: file.size, url: body.secure_url, publicId: body.public_id ?? '' }));
}

// The bytes of an attachment (for the email), whether it lives in Cloudinary or is an older stored copy.
export async function attachmentBytes(api: TravelAuthorityService, taId: string, a: TaAttachment): Promise<{ name: string; mime: string; bytes: Uint8Array }> {
  const got = await firstValueFrom(api.getAttachment(taId, a.id));
  if (got.url) {
    const r = await fetch(got.url);
    if (!r.ok) throw new Error(`Could not read ${got.name}. If it is a PDF, open Cloudinary › Settings › Security and tick “PDF and ZIP files delivery”.`);
    return { name: got.name, mime: got.mime, bytes: new Uint8Array(await r.arrayBuffer()) };
  }
  return { name: got.name, mime: got.mime, bytes: Uint8Array.from(atob(got.data ?? ''), (c) => c.charCodeAt(0)) };
}
