import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

interface SignedUpload {
  uploadUrl: string;
  fields: Record<string, string>;
}

// Mirrors the backend allow-list so people get an immediate, clear error.
const ALLOWED_TYPES = new Set(['image/jpeg', 'application/pdf']);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

@Injectable({ providedIn: 'root' })
export class UploadService {
  constructor(private http: HttpClient) {}

  // Ticket attachments / update images: JPG or PDF only.
  // (1) ask our API to sign an upload, (2) send the file straight to
  // Cloudinary. The file never passes through our backend. Returns the
  // permanent https URL to save on the ticket/update.
  async uploadFile(file: File): Promise<string> {
    if (!ALLOWED_TYPES.has(file.type)) {
      throw new Error('Only JPG images and PDF files are accepted.');
    }
    if (file.size > MAX_BYTES) {
      throw new Error('That file is too large (10 MB maximum).');
    }
    const signed = await firstValueFrom(
      this.http.post<SignedUpload>(`${environment.apiUrl}/uploads/sign`, {
        fileName: file.name,
        contentType: file.type,
      }),
    );
    return this.sendToCloudinary(signed, file, file.name);
  }

  // Profile picture: a small JPEG blob made by the avatar picker.
  async uploadAvatar(blob: Blob): Promise<string> {
    const signed = await firstValueFrom(
      this.http.post<SignedUpload>(`${environment.apiUrl}/uploads/sign-avatar`, {}),
    );
    return this.sendToCloudinary(signed, blob, 'avatar.jpg');
  }

  private async sendToCloudinary(signed: SignedUpload, file: Blob, name: string): Promise<string> {
    const form = new FormData();
    for (const [key, value] of Object.entries(signed.fields)) form.append(key, value);
    form.append('file', file, name);

    // Plain fetch on purpose: this goes to Cloudinary, not our API, so it
    // must not carry our Authorization header.
    const res = await fetch(signed.uploadUrl, { method: 'POST', body: form });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.secure_url) {
      throw new Error(body?.error?.message ?? `Upload failed (${res.status})`);
    }
    return body.secure_url as string;
  }
}
