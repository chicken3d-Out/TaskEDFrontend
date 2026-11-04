import { Component, Input, inject } from '@angular/core';
import { LegalService } from './legal.service';

// Contact shown on both documents. Change it here if the support address changes.
const CONTACT_EMAIL = 'vinceeentontuca@gmail.com';

// The Privacy Policy and Terms of Service text. Shown inside a modal in the app,
// and on the public /privacy and /terms pages (Google needs a web address for each).
@Component({
  selector: 'app-legal-content',
  standalone: true,
  template: `
      @if (kind() === 'terms') {
        <h1>Terms of Service</h1>
        <p class="meta">TaskEd · Schools Division of Leyte, Department of Education · Last updated {{ updated }}</p>

        <h2>1. What TaskEd is</h2>
        <p>TaskEd is a task, calendar and school-records system for personnel of the Schools Division of Leyte (DepEd). It is for official DepEd work only.</p>

        <h2>2. Who may use it</h2>
        <p>Only people with a DepEd (<strong>&#64;deped.gov.ph</strong>) Google account whose access has been approved by the Administrator. You are responsible for what is done with your account. Do not share it.</p>

        <h2>3. Acceptable use</h2>
        <p>Use TaskEd only for work-related purposes. Do not upload unlawful, harmful or unrelated material, and do not try to access other people's or other schools' data. Accounts that break these rules can be suspended by the Administrator.</p>

        <h2>4. Your files and calendar</h2>
        <p>Your files stay in your own Google Drive or OneDrive; TaskEd keeps only the links you add. School document links can be seen by the people who manage that school, as described in the <a href="/privacy" (click)="go($event, 'privacy')">Privacy Policy</a>.</p>

        <h2>5. Availability</h2>
        <p>TaskEd is provided as is. We try to keep it running but do not guarantee it will always be available or free of errors. Keep your own copy of important documents.</p>

        <h2>6. Changes</h2>
        <p>These terms may change. Continued use after a change means you accept it.</p>

        <h2>7. Contact</h2>
        <p>ICT Unit, Schools Division of Leyte · <a href="mailto:{{ email }}">{{ email }}</a></p>
      } @else {
        <h1>Privacy Policy</h1>
        <p class="meta">TaskEd · Schools Division of Leyte, Department of Education · Last updated {{ updated }}</p>

        <h2>1. Who we are</h2>
        <p>TaskEd is operated by the ICT Unit of the Schools Division of Leyte, Department of Education, Philippines. It helps DepEd personnel manage tasks, a shared calendar, school records and personal files.</p>

        <h2>2. What we collect</h2>
        <ul>
          <li><strong>Sign-in details</strong> from your Google account: name, DepEd email address and profile picture.</li>
          <li><strong>Profile details you enter:</strong> contact number, designation, school, district and area.</li>
          <li><strong>Your work in TaskEd:</strong> tasks, forum questions, announcements and the school documents you choose to upload.</li>
        </ul>

        <h2>3. Google permissions</h2>
        <p>TaskEd asks Google for only your <strong>name, email address and profile picture</strong>, to sign you in. It does <strong>not</strong> ask for access to your Google Drive or your Google Calendar, and it never changes anything in your Google account.</p>
        <ul>
          <li><strong>Files.</strong> Your files stay in your own Google Drive or OneDrive. If you want TaskEd to list a file, you paste its share link; TaskEd stores only that link, a label and a school year.</li>
          <li><strong>Calendar (optional).</strong> If you choose, you can paste the private iCal address of your Google Calendar so your own events show in TaskEd. TaskEd only reads that address, never writes to it. The address is stored encrypted, and you can remove it at any time. Your events are shown only to you.</li>
        </ul>
        <p>TaskEd's use of information received from Google adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener">Google API Services User Data Policy</a>. We do not use your data for advertising and do not sell it.</p>

        <h2>4. Who can see what</h2>
        <ul>
          <li>Your <strong>My files</strong> list and your <strong>Google Calendar events</strong> are visible only to you.</li>
          <li><strong>School document links</strong> can be viewed by the School account, School Head and Administrative Officer of that school, and by the Administrator. Whether someone can open the file itself depends on how you shared it in your own Drive.</li>
          <li>Your name, designation and school can be seen by other TaskEd users where needed for their work, for example in a school's personnel list.</li>
        </ul>

        <h2>5. Storage and security</h2>
        <p>TaskEd data is stored in a managed database. Profile pictures and task attachments are stored with Cloudinary. Your private calendar address, if you add one, is stored encrypted. Your files stay in your own Drive or OneDrive. We do not sell or share your data with third parties except the service providers needed to run TaskEd.</p>

        <h2>6. Your choices</h2>
        <ul>
          <li><strong>Calendar:</strong> click "Stop" on the Calendar page to remove your calendar address and the events copied from it.</li>
          <li><strong>My files and school document links:</strong> removing an entry in TaskEd does not delete the file from your Drive.</li>
          <li><strong>Sign-in:</strong> you can remove TaskEd's access to your Google account at <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener">myaccount.google.com/permissions</a>.</li>
          <li><strong>Access or deletion of your account data:</strong> ask the Administrator or write to the contact below.</li>
        </ul>

        <h2>7. Retention</h2>
        <p>We keep your account and records while you work for the Division. When an account is removed, its stored data, including any calendar address, is deleted.</p>

        <h2>8. Changes</h2>
        <p>If this policy changes, the date above is updated.</p>

        <h2>9. Contact</h2>
        <p>ICT Unit, Schools Division of Leyte · <a href="mailto:{{ email }}">{{ email }}</a></p>
      }
    `,
  styles: [`
    :host { display: block; line-height: 1.6; }
    h1 { margin: 0 0 0.2rem; font-size: 1.5rem; }
    h2 { font-size: 1.02rem; margin: 1.4rem 0 0.3rem; }
    .meta { color: var(--muted); font-size: 0.85rem; margin: 0 0 1rem; }
    ul { padding-left: 1.2rem; } li { margin: 0.35rem 0; }
    code { background: var(--surface-2); padding: 0.05rem 0.3rem; border-radius: 4px; }
  `],
})
export class LegalContentComponent {
  @Input() set type(v: 'privacy' | 'terms') {
    this._kind = v;
  }
  private _kind: 'privacy' | 'terms' = 'privacy';
  private legal = inject(LegalService);
  kind = () => this._kind;
  email = CONTACT_EMAIL;
  updated = 'November 2026';

  // Links between the two documents switch inside the modal instead of leaving the page.
  go(ev: Event, to: 'privacy' | 'terms') {
    if (this.legal.open()) {
      ev.preventDefault();
      this.legal.show(to);
    }
  }
}
