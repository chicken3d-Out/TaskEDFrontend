import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { CalendarService } from '../../core/services/calendar.service';
import { UsersService } from '../../core/services/users.service';

// Settings: the person's own links. Neither asks Google for any permission:
// TaskEd only stores a private calendar address and a folder link.
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <h1 class="page-title">Settings</h1>

      <section class="card">
        <h2>Google Calendar link</h2>
        <p class="muted">
          Optional. Shows your Google Calendar events inside TaskEd (one way: Google to TaskEd, only you can see them).
          TaskEd asks Google for no permission and never changes your calendar.
        </p>
        @if (linked) {
          <p class="ok">Your Google Calendar is linked.</p>
          <div class="row">
            <button class="btn secondary" type="button" (click)="unlink()" [disabled]="calBusy">Stop showing my calendar</button>
          </div>
        } @else {
          <ol class="steps">
            <li>Open <strong>calendar.google.com</strong> on a computer and sign in with your DepEd account.</li>
            <li>Click the gear icon, then <strong>Settings</strong>. On the left, under <em>Settings for my calendars</em>, click your calendar name.</li>
            <li>Scroll to <strong>Integrate calendar</strong> and copy the <strong>Secret address in iCal format</strong> (it ends in .ics).</li>
            <li>Paste it below. Keep it private: anyone with it can read your calendar.</li>
          </ol>
          <input class="linkbox" [(ngModel)]="icalUrl" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" />
          <div class="row">
            <button class="btn" type="button" [disabled]="!icalUrl.trim() || calBusy" (click)="saveCalendar()">
              @if (calBusy) { <span class="spinner"></span> Checking… } @else { Save calendar link }
            </button>
          </div>
        }
        @if (calMsg) { <p [class.error]="calErr" class="muted">{{ calMsg }}</p> }
      </section>

      <section class="card">
        <h2>My Google Drive folder</h2>
        <p class="muted">
          Create one folder in your own Google Drive for your TaskEd files (for example <em>TaskEd Files</em>, with
          <em>Personal Files</em>, <em>Scanned Files</em> and one <em>S.Y.</em> folder inside it), then paste that folder's
          link here. TaskEd only keeps the link so you can open the folder quickly. It never uploads to or reads your Drive.
        </p>
        <input class="linkbox" [(ngModel)]="folderUrl" placeholder="https://drive.google.com/drive/folders/…" />
        <div class="row">
          <button class="btn" type="button" [disabled]="driveBusy" (click)="saveFolder()">
            @if (driveBusy) { <span class="spinner"></span> Saving… } @else { Save folder link }
          </button>
          @if (savedFolder) {
            <a class="btn secondary" [href]="savedFolder" target="_blank" rel="noopener noreferrer">Open my Drive folder</a>
          }
          @if (savedFolder) {
            <button class="btn secondary" type="button" [disabled]="driveBusy" (click)="clearFolder()">Remove link</button>
          }
        </div>
        @if (driveMsg) { <p [class.error]="driveErr" class="muted">{{ driveMsg }}</p> }
      </section>
    </div>
  `,
  styles: [`
    .card { margin-bottom: 1rem; max-width: 760px; }
    h2 { font-size: 1.05rem; margin: 0 0 0.4rem; }
    .muted { color: var(--muted); font-size: 0.86rem; margin: 0.3rem 0 0.7rem; }
    .ok { color: var(--primary-strong); font-weight: 600; }
    .steps { font-size: 0.86rem; color: var(--muted); padding-left: 1.2rem; }
    .linkbox { width: 100%; margin-bottom: 0.6rem; }
    .row { display: flex; gap: 0.6rem; flex-wrap: wrap; align-items: center; }
    a.btn { text-decoration: none; display: inline-flex; align-items: center; }
    .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin 0.7s linear infinite; vertical-align: -2px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class SettingsComponent {
  private auth = inject(AuthService);
  private calendar = inject(CalendarService);
  private users = inject(UsersService);

  linked = !!this.auth.currentUser()?.calendarLinked;
  icalUrl = '';
  calBusy = false;
  calMsg: string | null = null;
  calErr = false;

  savedFolder: string | null = this.auth.currentUser()?.driveFolderUrl ?? null;
  folderUrl = this.savedFolder ?? '';
  driveBusy = false;
  driveMsg: string | null = null;
  driveErr = false;

  async saveCalendar() {
    this.calBusy = true;
    this.calMsg = null;
    this.calErr = false;
    try {
      await firstValueFrom(this.calendar.linkCalendar(this.icalUrl.trim()));
      this.linked = true;
      this.icalUrl = '';
      this.calMsg = 'Saved. Your events now show on the Calendar page.';
      this.auth.loadCurrentUser();
    } catch (e: any) {
      this.calErr = true;
      this.calMsg = e?.error?.message ?? 'Could not save the link.';
    }
    this.calBusy = false;
  }

  async unlink() {
    if (!confirm('Stop showing your Google Calendar in TaskEd? Nothing is changed in Google.')) return;
    this.calBusy = true;
    try {
      await firstValueFrom(this.calendar.unlinkCalendar());
      this.linked = false;
      this.calErr = false;
      this.calMsg = 'Your calendar link was removed.';
      this.auth.loadCurrentUser();
    } catch {
      this.calErr = true;
      this.calMsg = 'Could not remove the link.';
    }
    this.calBusy = false;
  }

  async saveFolder() {
    this.driveBusy = true;
    this.driveMsg = null;
    this.driveErr = false;
    try {
      const u = await firstValueFrom(this.users.setDriveFolder(this.folderUrl.trim()));
      this.savedFolder = u.driveFolderUrl ?? null;
      this.folderUrl = this.savedFolder ?? '';
      this.driveMsg = this.savedFolder ? 'Folder link saved.' : 'Folder link removed.';
      this.auth.loadCurrentUser();
    } catch (e: any) {
      this.driveErr = true;
      this.driveMsg = e?.error?.message ?? 'Could not save the link.';
    }
    this.driveBusy = false;
  }

  clearFolder() {
    this.folderUrl = '';
    this.saveFolder();
  }
}
