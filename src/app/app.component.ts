import { PdsEditorComponent } from './shared/pds/pds-editor.component';
import { PdsPreviewComponent } from './shared/pds/pds-preview.component';
import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LegalModalComponent } from './shared/legal/legal-modal.component';
import { FilePreviewComponent } from './shared/file-preview/file-preview.component';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, LegalModalComponent, FilePreviewComponent, PdsEditorComponent, PdsPreviewComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  constructor(private auth: AuthService) {}

  ngOnInit() {
    // Fires once at bootstrap; route guards await auth.loading() so nothing
    // navigates until this resolves.
    this.auth.loadCurrentUser();
    if (Capacitor.isNativePlatform()) {
      App.addListener('appUrlOpen', (event) => this.auth.handleDeepLink(event.url));
    }
  }
}
