import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PresignedUpload {
  uploadUrl: string;
  objectKey: string;
  fileUrl: string;
}

// Mirrors the backend's ALLOWED_UPLOAD_TYPES allow-list - checked here
// too so the person gets an immediate, clear error instead of waiting
// on a round-trip only to have the backend reject it.
const ALLOWED_TYPES = new Set(['image/jpeg', 'application/pdf']);

@Injectable({ providedIn: 'root' })
export class UploadService {
  constructor(private http: HttpClient) {}

  // Two-step upload: (1) ask our API for a presigned MinIO PUT URL
  // (content-type-bound, so only JPG/PDF are ever accepted), then
  // (2) PUT the raw file bytes straight to that URL - the file itself
  // never passes through our backend. Returns the stable, public fileUrl
  // to save on the ticket/update.
  async uploadFile(file: File): Promise<string> {
    if (!ALLOWED_TYPES.has(file.type)) {
      throw new Error('Only JPG images and PDF files are accepted.');
    }

    const presign = await firstValueFrom(
      this.http.post<PresignedUpload>(`${environment.apiUrl}/uploads/presign`, {
        fileName: file.name,
        contentType: file.type,
      }),
    );

    // Plain fetch on purpose: this goes straight to MinIO, not our API,
    // so it should NOT carry our Authorization bearer token (the auth
    // interceptor only attaches it to environment.apiUrl requests anyway,
    // but fetch sidesteps the interceptor chain entirely for clarity).
    // The Content-Type header MUST match what was signed into the URL.
    const putRes = await fetch(presign.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });
    if (!putRes.ok) {
      throw new Error(`Upload failed (${putRes.status})`);
    }

    return presign.fileUrl;
  }
}
