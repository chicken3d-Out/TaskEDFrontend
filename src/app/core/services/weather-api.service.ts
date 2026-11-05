import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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

  getForecast(lat: number, lon: number): Observable<WeatherForecast> {
    return this.http.get<WeatherForecast>(`${environment.apiUrl}/weather`, { params: { lat, lon } });
  }

  search(q: string): Observable<PlaceResult[]> {
    return this.http.get<PlaceResult[]>(`${environment.apiUrl}/weather/search`, { params: { q } });
  }
}
