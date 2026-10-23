import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface WeatherBucket {
  startTime: string;
  endTime: string;
  temperature: number | null;
  precipitationProbability: number | null;
}

export interface WeatherForecast {
  location: { latitude: number; longitude: number };
  current: { temperature: number | null; precipitationProbability: number | null };
  hourlyBuckets: WeatherBucket[];
}

@Injectable({ providedIn: 'root' })
export class WeatherApiService {
  constructor(private http: HttpClient) {}

  getForecast(lat: number, lon: number): Observable<WeatherForecast> {
    return this.http.get<WeatherForecast>(`${environment.apiUrl}/weather`, {
      params: { lat, lon },
    });
  }
}
