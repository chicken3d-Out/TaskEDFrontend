import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

declare const google: any;

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FOLDER = 'application/vnd.google-apps.folder';
const ROOT_NAME = 'TaskEd Files';
export const CATEGORIES: string[] = ['Personal Files', 'Scanned Files'];
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export interface UploadedFile {
  id: string;
  name: string;
  link: string;
}

// Saves files into the signed-in person's OWN Google Drive, straight from the
// browser. TaskEd's server never receives the file or any Google key. The
// permission (drive.file) only lets TaskEd see the files it creates, and it is
// asked once, the first time the person presses upload.
@Injectable({ providedIn: 'root' })
export class DriveUploadService {
  private http = inject(HttpClient);
  private clientId: string | null = null;
  private token: { value: string; until: number } | null = null;
  private scriptLoad?: Promise<void>;
  private folderCache = new Map<string, string>();

  private loadScript(): Promise<void> {
    if (!this.scriptLoad) {
      this.scriptLoad = new Promise((resolve, reject) => {
        if (typeof google !== 'undefined' && google?.accounts?.oauth2) return resolve();
        const s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => {
          this.scriptLoad = undefined;
          reject(new Error('Could not reach Google. Check your internet connection and try again.'));
        };
        document.head.appendChild(s);
      });
    }
    return this.scriptLoad;
  }

  // Must be called straight from a click so the browser allows Google's popup.
  async accessToken(emailHint?: string | null): Promise<string> {
    if (this.token && this.token.until > Date.now() + 30_000) return this.token.value;
    if (this.clientId === null) {
      const cfg = await firstValueFrom(this.http.get<{ clientId: string }>(`${environment.apiUrl}/my-files/drive-config`));
      this.clientId = cfg.clientId ?? '';
    }
    if (!this.clientId) throw new Error('Drive upload is not set up on the server yet.');
    await this.loadScript();
    return new Promise<string>((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: this.clientId,
        scope: SCOPE,
        hint: emailHint || undefined,
        callback: (r: any) => {
          if (r?.error || !r?.access_token) {
            reject(new Error(r?.error === 'access_denied' ? 'Permission was not given, so nothing was uploaded.' : 'Could not get permission from Google.'));
            return;
          }
          this.token = { value: r.access_token, until: Date.now() + Number(r.expires_in ?? 3000) * 1000 };
          resolve(r.access_token);
        },
        error_callback: () => reject(new Error('The Google window was closed before permission was given.')),
      });
      client.requestAccessToken({ prompt: this.token ? '' : undefined });
    });
  }

  private async api(token: string, path: string, init?: RequestInit) {
    const res = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    if (res.status === 401) this.token = null;
    if (!res.ok) throw new Error(res.status === 401 ? 'Google asked you to give permission again. Please try once more.' : `Google Drive said no (${res.status}).`);
    return res.json();
  }

  static fileId(link: string): string | null {
    const m = /\/d\/([\w-]+)/.exec(link) ?? /[?&]id=([\w-]+)/.exec(link);
    return m ? m[1] : null;
  }

  // Downloads a file TaskEd put in the person's Drive.
  async download(token: string, fileId: string): Promise<ArrayBuffer> {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) this.token = null;
    if (!res.ok) throw new Error(res.status === 404 ? 'TaskEd can only open files it uploaded. Upload this file through TaskEd first.' : `Google Drive said no (${res.status}).`);
    return res.arrayBuffer();
  }

  async fileName(token: string, fileId: string): Promise<string> {
    const r = await this.api(token, `files/${fileId}?fields=name`);
    return r?.name ?? 'file';
  }

  // Saves a Blob to the device.
  static saveBlob(blob: Blob, name: string) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  // Moves a file TaskEd put in the person's Drive to the Drive Trash (restorable for 30 days).
  // A file that is already gone counts as done.
  async trash(token: string, fileId: string): Promise<void> {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true }),
    });
    if (res.status === 401) this.token = null;
    if (res.ok || res.status === 404) return;
    throw new Error(`Google Drive said no (${res.status}).`);
  }

  // Replaces the content of a file TaskEd put in the person's Drive.
  async replaceContent(token: string, fileId: string, blob: Blob): Promise<void> {
    const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': blob.type || 'application/octet-stream' },
      body: blob,
    });
    if (res.status === 401) this.token = null;
    if (!res.ok) throw new Error(`Google Drive said no (${res.status}).`);
  }

  // Finds a folder TaskEd made earlier, or makes it.
  private async folder(token: string, name: string, parent: string): Promise<string> {
    const key = `${parent}/${name}`;
    const cached = this.folderCache.get(key);
    if (cached) return cached;
    const esc = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const q = encodeURIComponent(`name='${esc}' and '${parent}' in parents and mimeType='${FOLDER}' and trashed=false`);
    const found = await this.api(token, `files?q=${q}&fields=files(id)&pageSize=1`);
    let id: string | undefined = found.files?.[0]?.id;
    if (!id) {
      const made = await this.api(token, 'files?fields=id', {
        method: 'POST',
        body: JSON.stringify({ name, mimeType: FOLDER, parents: [parent] }),
      });
      id = made.id as string;
    }
    this.folderCache.set(key, id);
    return id;
  }

  // TaskEd Files / <Personal Files | Scanned Files | a folder the person named> / S.Y. 2026-2027.
  // Every folder is created on the spot if it does not exist yet.
  async ensureFolder(token: string, category: string, schoolYear: string): Promise<string> {
    const root = await this.folder(token, ROOT_NAME, 'root');
    const cat = await this.folder(token, category, root);
    return this.folder(token, `S.Y. ${schoolYear}`, cat);
  }

  // TaskEd Files / a / b / c ... (every folder is created if missing)
  async ensurePath(token: string, names: string[]): Promise<string> {
    let parent = await this.folder(token, ROOT_NAME, 'root');
    for (const n of names) parent = await this.folder(token, n.replace(/[\\/]+/g, ' ').trim().slice(0, 80) || 'Folder', parent);
    return parent;
  }

  upload(token: string, parent: string, file: File, onProgress: (pct: number) => void): Promise<UploadedFile> {
    return new Promise((resolve, reject) => {
      const boundary = 'tasked' + Math.random().toString(36).slice(2);
      const meta = JSON.stringify({ name: file.name, parents: [parent] });
      const body = new Blob([
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`,
        file,
        `\r\n--${boundary}--`,
      ]);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('Content-Type', `multipart/related; boundary=${boundary}`);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
      xhr.onerror = () => reject(new Error('The upload was interrupted. Check your internet connection.'));
      xhr.onload = () => {
        if (xhr.status === 401) this.token = null;
        if (xhr.status < 200 || xhr.status >= 300) return reject(new Error(`Google Drive could not save the file (${xhr.status}).`));
        const r = JSON.parse(xhr.responseText);
        resolve({ id: r.id, name: r.name, link: r.webViewLink });
      };
      xhr.send(body);
    });
  }
}
