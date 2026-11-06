import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number; // metres
}

export type LocationFailure = 'denied' | 'unavailable' | 'timeout' | 'insecure' | 'unsupported';

export class LocationError extends Error {
  constructor(public reason: LocationFailure) {
    super(reason);
  }
}

@Injectable({ providedIn: 'root' })
export class LocationService {
  async getCurrentPosition(): Promise<Coordinates> {
    // Native app: use the Capacitor plugin (it asks Android for permission).
    if (Capacitor.isNativePlatform()) {
      try {
        const p = await Geolocation.checkPermissions();
        if (p.location !== 'granted' && p.coarseLocation !== 'granted') {
          const r = await Geolocation.requestPermissions();
          if (r.location !== 'granted' && r.coarseLocation !== 'granted') throw new LocationError('denied');
        }
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
        return { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy };
      } catch (e) {
        throw e instanceof LocationError ? e : new LocationError('unavailable');
      }
    }

    // Browser: call the standard API directly (the plugin's web permission
    // helpers are not reliable across browsers).
    if (!('geolocation' in navigator)) throw new LocationError('unsupported');
    if (!window.isSecureContext) throw new LocationError('insecure');
    try {
      return await this.browserPosition({ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
    } catch (e) {
      if (e instanceof LocationError && e.reason === 'denied') throw e;
      // Laptops have no GPS: retry with network (Wi-Fi/IP) location, which is much faster.
      return this.browserPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
    }
  }

  private browserPosition(opts: PositionOptions): Promise<Coordinates> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }),
        (err) =>
          reject(new LocationError(err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'unavailable')),
        opts,
      );
    });
  }
}
