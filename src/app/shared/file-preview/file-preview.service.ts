import { Injectable, signal } from '@angular/core';

export interface PreviewState {
  name: string;
  link: string;
  embed: string | null; // embeddable URL, or null when only "open in new tab" works
}

// Turns a pasted share link into something that can be shown inside the
// page. Only Google Drive / Docs links can be embedded this way; folders,
// OneDrive and SharePoint links open in a new tab instead.
export function embedUrl(link: string): string | null {
  try {
    const u = new URL(link);
    if (u.hostname === 'drive.google.com') {
      const m = u.pathname.match(/^\/file\/d\/([^/]+)/);
      if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
    }
    if (u.hostname === 'docs.google.com') {
      const m = u.pathname.match(/^\/(document|spreadsheets|presentation)\/d\/([^/]+)/);
      if (m) return `https://docs.google.com/${m[1]}/d/${m[2]}/preview`;
    }
  } catch {
    /* not a URL */
  }
  return null;
}

@Injectable({ providedIn: 'root' })
export class FilePreviewService {
  readonly state = signal<PreviewState | null>(null);
  open(link: string, name: string) {
    this.state.set({ link, name, embed: embedUrl(link) });
  }
  close() {
    this.state.set(null);
  }
}
