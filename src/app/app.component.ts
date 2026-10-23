import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
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
