import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { LocationError, LocationService } from '../../core/services/location.service';
import { PlaceResult, WeatherApiService, WeatherForecast } from '../../core/services/weather-api.service';
import { TyphoonTrackerComponent } from './typhoon-tracker.component';
import { EarthquakesComponent } from './earthquakes.component';
import { LoadingComponent } from '../../shared/loading/loading.component';

type LoadState = 'idle' | 'requesting' | 'loading' | 'ready' | 'error';

// WMO weather codes (Open-Meteo) -> a short label and an emoji.
function describe(code: number | null | undefined): { label: string; icon: string } {
  if (code == null) return { label: '–', icon: '·' };
  if (code === 0) return { label: 'Clear sky', icon: '☀️' };
  if (code === 1) return { label: 'Mostly clear', icon: '🌤️' };
  if (code === 2) return { label: 'Partly cloudy', icon: '⛅' };
  if (code === 3) return { label: 'Overcast', icon: '☁️' };
  if (code === 45 || code === 48) return { label: 'Fog', icon: '🌫️' };
  if (code >= 51 && code <= 57) return { label: 'Drizzle', icon: '🌦️' };
  if (code >= 61 && code <= 67) return { label: code >= 65 ? 'Heavy rain' : 'Rain', icon: '🌧️' };
  if (code >= 80 && code <= 82) return { label: 'Rain showers', icon: '🌦️' };
  if (code >= 95) return { label: 'Thunderstorm', icon: '⛈️' };
  return { label: 'Cloudy', icon: '☁️' };
}

@Component({
  selector: 'app-weather',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingComponent, TyphoonTrackerComponent, EarthquakesComponent],
  templateUrl: './weather.component.html',
  styleUrl: './weather.component.scss',
})
export class WeatherComponent implements OnInit {
  private locationService = inject(LocationService);
  private weatherApi = inject(WeatherApiService);
  private sanitizer = inject(DomSanitizer);

  @ViewChild('hourList') hourList?: ElementRef<HTMLElement>;

  state: LoadState = 'idle';
  errorMessage = '';
  forecast: WeatherForecast | null = null;
  mapUrl: SafeResourceUrl | null = null;
  selectedDay = 0;
  accuracy: number | null = null;
  usingMyLocation = false;

  query = '';
  results: PlaceResult[] = [];
  searching = false;
  searchMsg = '';

  describe = describe;

  tab: 'forecast' | 'radar' | 'typhoon' | 'quake' = 'forecast';
  layer: 'radar' | 'satellite' | 'clouds' | 'rain' = 'radar';
  layers: { id: 'radar' | 'satellite' | 'clouds' | 'rain'; label: string }[] = [
    { id: 'radar', label: 'Rain radar' },
    { id: 'satellite', label: 'Satellite' },
    { id: 'clouds', label: 'Clouds' },
    { id: 'rain', label: 'Rain forecast' },
  ];
  radarUrl: SafeResourceUrl | null = null;
  typhoonLinks = [
    { label: 'PAGASA – tropical cyclone bulletin', url: 'https://bagong.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin' },
    { label: 'PAGASA – satellite & radar', url: 'https://bagong.pagasa.dost.gov.ph/weather/satellite' },
    { label: 'Windy – typhoon tracker', url: 'https://www.windy.com/-Hurricanes-tropical-cyclones/tropical-cyclones?cyclones,12.0,122.0,5' },
    { label: 'JTWC – warnings', url: 'https://www.metoc.navy.mil/jtwc/jtwc.html' },
  ];

  setTab(t: 'forecast' | 'radar' | 'typhoon' | 'quake') {
    this.tab = t;
    if (t === 'radar' && !this.radarUrl) this.setLayer(this.layer);
  }

  setLayer(l: 'radar' | 'satellite' | 'clouds' | 'rain') {
    this.layer = l;
    this.radarUrl = this.windy(l === 'rain' ? 'rain' : l, l === 'radar' ? 'radar' : 'ecmwf');
  }

  // Windy's free embeddable map, centred on the Philippines.
  private windy(overlay: string, product: string): SafeResourceUrl {
    const u =
      `https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=mm&metricTemp=%C2%B0C&metricWind=km%2Fh` +
      `&zoom=5&overlay=${overlay}&product=${product}&level=surface&lat=12.5&lon=122&message=true`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(u);
  }

  ngOnInit() {
    this.useMyLocation();
  }

  // Ask the device for its real position (the browser shows its own permission prompt).
  async useMyLocation() {
    this.state = 'requesting';
    this.errorMessage = '';
    try {
      const c = await this.locationService.getCurrentPosition();
      this.accuracy = c.accuracy ?? null;
      this.usingMyLocation = true;
      this.load(c.latitude, c.longitude);
    } catch (e) {
      const r = e instanceof LocationError ? e.reason : 'unavailable';
      const msg: Record<string, string> = {
        denied: 'Location is blocked for this site. Tap the padlock next to the address, set Location to Allow, reload, then press the button again.',
        timeout: 'Your device took too long to find its location. Check that GPS/Wi-Fi is on and try again.',
        insecure: 'Location only works on a secure (https://) address.',
        unsupported: 'This browser does not support location.',
        unavailable: 'Your device could not determine its location. Turn on Location/GPS and try again.',
      };
      this.errorMessage = (msg[r] ?? msg['unavailable']) + ' You can also search for your town below.';
      this.state = this.forecast ? 'ready' : 'error';
    }
  }

  private load(lat: number, lon: number) {
    this.state = 'loading';
    this.buildMapUrl(lat, lon);
    this.weatherApi.getForecast(lat, lon).subscribe({
      next: (f) => {
        this.forecast = f;
        this.selectedDay = 0;
        this.state = 'ready';
        setTimeout(() => this.scrollToNow(), 80);
      },
      error: () => {
        this.errorMessage = 'Could not load the forecast right now. Please try again.';
        this.state = 'error';
      },
    });
  }

  search() {
    const q = this.query.trim();
    if (q.length < 2) return;
    this.searching = true;
    this.searchMsg = '';
    this.weatherApi.search(q).subscribe({
      next: (r) => {
        this.results = r;
        this.searching = false;
        if (!r.length) this.searchMsg = 'No place found. Try the town or barangay name.';
      },
      error: () => {
        this.searching = false;
        this.searchMsg = 'Search is unavailable right now.';
      },
    });
  }

  pick(p: PlaceResult) {
    this.results = [];
    this.query = '';
    this.usingMyLocation = false;
    this.accuracy = null;
    this.load(p.latitude, p.longitude);
  }

  selectDay(i: number) {
    this.selectedDay = i;
    setTimeout(() => this.scrollToNow(), 80);
  }

  get day() {
    return this.forecast?.days[this.selectedDay] ?? null;
  }

  isNow(time: string): boolean {
    const now = this.forecast?.current.time;
    return this.selectedDay === 0 && !!now && time.slice(0, 13) === now.slice(0, 13);
  }

  isPast(time: string): boolean {
    const now = this.forecast?.current.time;
    return this.selectedDay === 0 && !!now && time.slice(0, 13) < now.slice(0, 13);
  }

  private scrollToNow() {
    const el = this.hourList?.nativeElement.querySelector('.now') as HTMLElement | null;
    if (el && this.hourList) this.hourList.nativeElement.scrollTop = Math.max(0, el.offsetTop - 60);
  }

  private buildMapUrl(lat: number, lon: number) {
    const delta = 0.01;
    const bbox = `${lon - delta}%2C${lat - delta}%2C${lon + delta}%2C${lat + delta}`;
    const url = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&marker=${lat}%2C${lon}`;
    this.mapUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}
