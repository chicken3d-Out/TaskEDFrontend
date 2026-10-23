import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { LocationService } from '../../core/services/location.service';
import { WeatherApiService, WeatherForecast } from '../../core/services/weather-api.service';
import { LoadingComponent } from '../../shared/loading/loading.component';

type LoadState = 'idle' | 'requesting' | 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-weather',
  standalone: true,
  imports: [CommonModule, LoadingComponent],
  templateUrl: './weather.component.html',
  styleUrl: './weather.component.scss',
})
export class WeatherComponent implements OnInit {
  private locationService = inject(LocationService);
  private weatherApi = inject(WeatherApiService);
  private sanitizer = inject(DomSanitizer);

  state: LoadState = 'idle';
  errorMessage = '';
  forecast: WeatherForecast | null = null;
  mapUrl: SafeResourceUrl | null = null;

  ngOnInit() {
    this.requestLocation();
  }

  async requestLocation() {
    this.state = 'requesting';
    this.errorMessage = '';
    try {
      const coords = await this.locationService.getCurrentPosition();
      this.state = 'loading';
      this.buildMapUrl(coords.latitude, coords.longitude);
      this.weatherApi.getForecast(coords.latitude, coords.longitude).subscribe({
        next: (forecast) => {
          this.forecast = forecast;
          this.state = 'ready';
        },
        error: () => {
          this.errorMessage = 'Could not load the forecast right now.';
          this.state = 'error';
        },
      });
    } catch {
      this.errorMessage =
        'Location permission was denied or is unavailable. Enable location access and try again.';
      this.state = 'error';
    }
  }

  private buildMapUrl(lat: number, lon: number) {
    // OpenStreetMap's embeddable export view - no API key required.
    const delta = 0.01;
    const bbox = `${lon - delta}%2C${lat - delta}%2C${lon + delta}%2C${lat + delta}`;
    const url = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&marker=${lat}%2C${lon}`;
    this.mapUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}
