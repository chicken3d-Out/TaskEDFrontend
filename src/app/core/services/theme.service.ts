import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';
const KEY = 'tasked_theme';

// Light / dark. Until the person chooses, the phone's own setting decides. The choice is remembered on this device.
@Injectable({ providedIn: 'root' })
export class ThemeService {
  mode = signal<ThemeMode>(this.initial());

  constructor() {
    this.apply(this.mode());
  }

  private initial(): ThemeMode {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch { /* storage blocked: follow the device */ }
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  toggle() {
    const next: ThemeMode = this.mode() === 'dark' ? 'light' : 'dark';
    this.mode.set(next);
    try { localStorage.setItem(KEY, next); } catch { /* not kept; fine */ }
    this.apply(next);
  }

  private apply(m: ThemeMode) {
    document.documentElement.setAttribute('data-theme', m);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', m === 'dark' ? '#0b1210' : '#15803d');
  }
}
