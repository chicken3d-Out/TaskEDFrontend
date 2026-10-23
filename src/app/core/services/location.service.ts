import { Injectable } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Uses @capacitor/geolocation instead of the raw browser API - it has a
// web implementation too (falls back to navigator.geolocation under the
// hood), so this works unchanged whether the app is running in a browser
// or wrapped natively via Capacitor. This was the one file the rest of
// the app was written to depend on for location - now that the Ionic
// wrapper exists, this is the only file that changed for it.
@Injectable({ providedIn: 'root' })
export class LocationService {
  async getCurrentPosition(): Promise<Coordinates> {
    const permission = await Geolocation.checkPermissions();
    if (permission.location !== 'granted') {
      const requested = await Geolocation.requestPermissions();
      if (requested.location !== 'granted') {
        throw new Error('Location permission was denied');
      }
    }

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    });
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  }
}
