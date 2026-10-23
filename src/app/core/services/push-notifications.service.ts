import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { environment } from '../../../environments/environment';

// Device push only exists in the native (Ionic/Capacitor) build - there's
// no equivalent for a plain browser tab, so every method here is a no-op
// on web. Call register() once after login; it's safe to call repeatedly
// (it just no-ops if already registered or not on a native platform).
@Injectable({ providedIn: 'root' })
export class PushNotificationsService {
  private registered = false;

  constructor(private http: HttpClient) {}

  async register(): Promise<void> {
    if (!Capacitor.isNativePlatform() || this.registered) return;

    const permission = await PushNotifications.checkPermissions();
    if (permission.receive !== 'granted') {
      const requested = await PushNotifications.requestPermissions();
      if (requested.receive !== 'granted') return; // user declined - nothing more to do
    }

    // 'registration' fires once the OS hands back an FCM device token;
    // 'registrationError' fires if that fails (e.g. Firebase isn't
    // configured for this app yet - see the Capacitor push setup docs).
    PushNotifications.addListener('registration', (token) => {
      this.http
        .post(`${environment.apiUrl}/users/me/push-token`, { token: token.value })
        .subscribe({
          error: () => {
            // Non-fatal: the app still works without push, just quietly
            // without device notifications until this succeeds.
          },
        });
    });
    PushNotifications.addListener('registrationError', (err) => {
      console.error('Push registration failed', err);
    });

    await PushNotifications.register();
    this.registered = true;
  }
}
