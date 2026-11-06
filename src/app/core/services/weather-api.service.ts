import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, from, map, of, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface WeatherHour {
  time: string;
  temperature: number | null;
  humidity: number | null;
  precipitationProbability: number | null;
  precipitation: number | null;
  code: number | null;
}

export interface WeatherDay {
  date: string;
  tempMax: number | null;
  tempMin: number | null;
  precipitationProbabilityMax: number | null;
  code: number | null;
  hours: WeatherHour[];
}

export interface WeatherForecast {
  location: { latitude: number; longitude: number; name: string | null };
  current: {
    temperature: number | null;
    feelsLike: number | null;
    humidity: number | null;
    precipitationProbability: number | null;
    code: number | null;
    time: string | null;
  };
  days: WeatherDay[];
}

export interface PlaceResult {
  name: string;
  detail: string;
  latitude: number;
  longitude: number;
}

@Injectable({ providedIn: 'root' })
export class WeatherApiService {
  constructor(private http: HttpClient) {}

  // TaskEd server first; if it is asleep/unreachable, ask Open-Meteo directly
  // (free, no key, allows browser requests) so the page still works.
  getForecast(lat: number, lon: number): Observable<WeatherForecast> {
    return this.http
      .get<WeatherForecast>(`${environment.apiUrl}/weather`, { params: { lat, lon } })
      .pipe(catchError(() => this.directForecast(lat, lon)));
  }

  search(q: string): Observable<PlaceResult[]> {
    return this.http.get<PlaceResult[]>(`${environment.apiUrl}/weather/search`, { params: { q } }).pipe(
      catchError(() => of([] as PlaceResult[])),
      switchMap((r) => (r.length ? of(r) : this.directSearch(q))),
    );
  }

  private directSearch(q: string): Observable<PlaceResult[]> {
    const geo = (cc: boolean) =>
      this.http
        .get<any>('https://geocoding-api.open-meteo.com/v1/search', {
          params: { name: q, count: 8, language: 'en', format: 'json', ...(cc ? { countryCode: 'PH' } : {}) },
        })
        .pipe(
          map((d) =>
            (d?.results ?? []).map((r: any) => ({
              name: r.name,
              detail: [r.admin2, r.admin1].filter(Boolean).join(', '),
              latitude: r.latitude,
              longitude: r.longitude,
            })),
          ),
          catchError(() => of([] as PlaceResult[])),
        );
    // Open-Meteo knows towns; OpenStreetMap also knows barangays and schools.
    const osm = this.http
      .get<any[]>('https://nominatim.openstreetmap.org/search', {
        params: { q, format: 'jsonv2', countrycodes: 'ph', limit: 8, addressdetails: 1 },
      })
      .pipe(
        map((rows) =>
          (rows ?? []).map((r) => ({
            name: r.name || String(r.display_name).split(',')[0],
            detail: String(r.display_name).split(',').slice(1, 4).join(',').trim(),
            latitude: Number(r.lat),
            longitude: Number(r.lon),
          })),
        ),
        catchError(() => of([] as PlaceResult[])),
      );
    return geo(true).pipe(switchMap((r) => (r.length ? of(r) : osm)));
  }

  private directForecast(lat: number, lon: number): Observable<WeatherForecast> {
    const hourly = 'temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code';
    return this.http
      .get<any>('https://api.open-meteo.com/v1/forecast', {
        params: {
          latitude: lat,
          longitude: lon,
          current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,weather_code',
          hourly,
          daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
          forecast_days: 7,
          timezone: 'auto',
        },
      })
      .pipe(
        switchMap((data) => {
          const h = data.hourly ?? {};
          const days: WeatherDay[] = (data.daily?.time ?? []).map((date: string, di: number) => ({
            date,
            tempMax: data.daily.temperature_2m_max?.[di] ?? null,
            tempMin: data.daily.temperature_2m_min?.[di] ?? null,
            precipitationProbabilityMax: data.daily.precipitation_probability_max?.[di] ?? null,
            code: data.daily.weather_code?.[di] ?? null,
            hours: [],
          }));
          const byDate = new Map(days.map((d) => [d.date, d]));
          (h.time ?? []).forEach((t: string, i: number) => {
            byDate.get(t.slice(0, 10))?.hours.push({
              time: t,
              temperature: h.temperature_2m?.[i] ?? null,
              humidity: h.relative_humidity_2m?.[i] ?? null,
              precipitationProbability: h.precipitation_probability?.[i] ?? null,
              precipitation: h.precipitation?.[i] ?? null,
              code: h.weather_code?.[i] ?? null,
            });
          });
          const c = data.current ?? {};
          const base: WeatherForecast = {
            location: { latitude: lat, longitude: lon, name: null },
            current: {
              temperature: c.temperature_2m ?? null,
              feelsLike: c.apparent_temperature ?? null,
              humidity: c.relative_humidity_2m ?? null,
              precipitationProbability: c.precipitation_probability ?? null,
              code: c.weather_code ?? null,
              time: c.time ?? null,
            },
            days,
          };
          return this.http
            .get<any>('https://nominatim.openstreetmap.org/reverse', {
              params: { format: 'jsonv2', zoom: 14, lat, lon },
            })
            .pipe(
              map((d) => {
                const a = d?.address ?? {};
                const parts = [a.suburb || a.village || a.neighbourhood, a.municipality || a.city || a.town, a.state || a.province].filter(Boolean);
                base.location.name = parts.length ? [...new Set(parts)].join(', ') : (d?.display_name ?? null);
                return base;
              }),
              catchError(() => of(base)),
            );
        }),
      );
  }
}
