import { PdsEditorComponent } from './shared/pds/pds-editor.component';
import { PdsPreviewComponent } from './shared/pds/pds-preview.component';
import { SrEditorComponent } from './shared/service-record/sr-editor.component';
import { SalnEditorComponent } from './shared/saln/saln-editor.component';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LegalModalComponent } from './shared/legal/legal-modal.component';
import { FilePreviewComponent } from './shared/file-preview/file-preview.component';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, LegalModalComponent, FilePreviewComponent, PdsEditorComponent, PdsPreviewComponent, SalnEditorComponent, SrEditorComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit, OnDestroy {
  constructor(public auth: AuthService) {}
  slow = signal(false);
  private slowTimer?: ReturnType<typeof setTimeout>;
  ngOnDestroy() { clearTimeout(this.slowTimer); }

  ngOnInit() {
    // Fires once at bootstrap; route guards await auth.loading() so nothing
    // navigates until this resolves.
    // If the server is asleep (free hosting) tell the person instead of showing a blank page.
    this.slowTimer = setTimeout(() => this.slow.set(true), 3000);
    this.auth.loadCurrentUser();
    if (Capacitor.isNativePlatform()) {
      App.addListener('appUrlOpen', (event) => this.auth.handleDeepLink(event.url));
    }
  }
}
