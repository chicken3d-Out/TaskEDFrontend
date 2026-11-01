import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

// Contact shown on both pages. Change it here if the support address changes.
const CONTACT_EMAIL = 'vincent.ontuca@deped.gov.ph';

// Public pages (no sign-in): Privacy Policy and Terms of Service. Google asks
// for both when an app uses sensitive scopes such as Drive and Calendar.
@Component({
  selector: 'app-legal',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="wrap">
      <a routerLink="/login" class="back">← TaskEd</a>
      @if (kind === 'terms') {
        <h1>Terms of Service</h1>
        <p class="meta">TaskEd · Schools Division of Leyte, Department of Education · Last updated {{ updated }}</p>

        <h2>1. What TaskEd is</h2>
        <p>TaskEd is a task, calendar and school-records system for personnel of the Schools Division of Leyte (DepEd). It is for official DepEd work only.</p>

        <h2>2. Who may use it</h2>
        <p>Only people with a DepEd (<strong>&#64;deped.gov.ph</strong>) Google account whose access has been approved by the Administrator. You are responsible for what is done with your account. Do not share it.</p>

        <h2>3. Acceptable use</h2>
        <p>Use TaskEd only for work-related purposes. Do not upload unlawful, harmful or unrelated material, and do not try to access other people's or other schools' data. Accounts that break these rules can be suspended by the Administrator.</p>

        <h2>4. Your files and calendar</h2>
        <p>Files you upload and calendar events are kept in your own Google account. You can disconnect Google at any time, as described in the <a routerLink="/privacy">Privacy Policy</a>. School documents you upload for your school can be seen by the people who manage that school, as described there.</p>

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

        <h2>3. How TaskEd uses your Google data</h2>
        <p>With your permission, TaskEd asks for two extra Google permissions. We use them only for the features below.</p>
        <ul>
          <li><strong>Google Drive (<code>drive.file</code>).</strong> TaskEd can see and manage <em>only the files and folders it creates itself</em>, never the rest of your Drive. It uses this to save the school documents and personal files you upload into a "TaskEd" folder in your own Drive, organised by school year, and to remove them when you delete them in TaskEd.</li>
          <li><strong>Google Calendar (<code>calendar.events</code>).</strong> TaskEd adds division events and announcements to your Google Calendar, keeps them up to date, and reads your calendar events so you can see them next to division events in TaskEd. Your own Google events are shown only to you.</li>
        </ul>
        <p>TaskEd's use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener">Google API Services User Data Policy</a>, including the Limited Use requirements. We do not use Google data for advertising, do not sell it, and do not let people read it except as described here.</p>

        <h2>4. Who can see what</h2>
        <ul>
          <li>Your <strong>personal files</strong> ("My files") are visible only to you.</li>
          <li><strong>School documents</strong> can be viewed by the School account, School Head and Administrative Officer of that school, and by the Administrator. They are downloaded through TaskEd, which checks permission first; your Drive folders are not shared.</li>
          <li>Your <strong>Google Calendar events</strong> are never shown to others.</li>
          <li>Your name, designation and school can be seen by other TaskEd users where needed for their work, for example in a school's personnel list.</li>
        </ul>

        <h2>5. Storage and security</h2>
        <p>TaskEd data is stored in a managed database. Profile pictures and task attachments are stored with Cloudinary. Your Google access token is stored encrypted. Files you upload to Drive stay in your Google account. We do not sell or share your data with third parties except the service providers needed to run TaskEd.</p>

        <h2>6. Your choices</h2>
        <ul>
          <li><strong>Disconnect Google:</strong> remove TaskEd at <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener">myaccount.google.com/permissions</a>. TaskEd stops using Drive and Calendar right away. Files already in your Drive stay there.</li>
          <li><strong>Delete a file:</strong> deleting it in TaskEd also removes it from your Drive.</li>
          <li><strong>Access or deletion of your account data:</strong> ask the Administrator or write to the contact below.</li>
        </ul>

        <h2>7. Retention</h2>
        <p>We keep your account and records while you work for the Division. When an account is removed, its stored Google access is deleted.</p>

        <h2>8. Changes</h2>
        <p>If this policy changes, the date above is updated.</p>

        <h2>9. Contact</h2>
        <p>ICT Unit, Schools Division of Leyte · <a href="mailto:{{ email }}">{{ email }}</a></p>
      }
    </main>
  `,
  styles: [`
    .wrap { max-width: 760px; margin: 0 auto; padding: 2rem 1.2rem 4rem; line-height: 1.6; color: var(--text); }
    .back { color: var(--muted); text-decoration: none; font-size: 0.9rem; }
    h1 { margin: 1rem 0 0.2rem; }
    h2 { font-size: 1.05rem; margin: 1.6rem 0 0.3rem; }
    .meta { color: var(--muted); font-size: 0.85rem; margin: 0 0 1rem; }
    ul { padding-left: 1.2rem; } li { margin: 0.35rem 0; }
    code { background: var(--surface-2); padding: 0.05rem 0.3rem; border-radius: 4px; }
  `],
})
export class LegalComponent {
  kind: 'privacy' | 'terms' = inject(ActivatedRoute).snapshot.data['kind'] ?? 'privacy';
  email = CONTACT_EMAIL;
  updated = 'November 2026';
}
