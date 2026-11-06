import { AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { LocationService } from '../../core/services/location.service';
import { HazardsApiService, Quake } from '../../core/services/weather-api.service';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const FEEL = ['', 'Scarcely perceptible', 'Slightly felt', 'Weak', 'Moderately strong', 'Strong', 'Very strong', 'Destructive', 'Very destructive', 'Devastating', 'Completely devastating'];

@Component({
  selector: 'app-earthquakes',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (alert) { <div class="alert">⚠️ {{ alert }}</div> }
    <div #map class="hz-map"></div>
    @if (loading) { <p class="muted">Loading earthquakes…</p> }
    @else if (failed) { <p class="muted">Earthquake data is unavailable right now. Try again later or check PHIVOLCS.</p> }
    @else if (!quakes.length) { <p class="muted">No earthquakes of magnitude 2.5 or higher in the Philippine area in the last 7 days.</p> }
    @if (!hasLoc) { <p class="muted">Allow location on the Forecast tab to sort by distance from you.</p> }
    <div class="qlist">
      @for (q of quakes; track q.id) {
        <a class="q" [href]="q.url" target="_blank" rel="noopener" (mouseenter)="highlight(q)">
          <span class="mag" [style.background]="magColor(q.magnitude)">M{{ q.magnitude.toFixed(1) }}</span>
          <span class="info">
            <b>{{ q.place }}</b>
            <small>{{ q.time | date: 'MMM d, h:mm a' }} · depth {{ q.depthKm }} km
              @if (q.distanceKm != null) { · {{ q.distanceKm }} km from you }
            </small>
            @if (q.estimatedIntensity) { <small>Estimated shaking at your location: Intensity {{ roman(q.estimatedIntensity) }} – {{ feel(q.estimatedIntensity) }}</small> }
            @if (q.reportedIntensity) { <small>Reported max intensity: {{ roman(q.reportedIntensity) }}</small> }
          </span>
        </a>
      }
    </div>
    <p class="muted">Source: USGS (last 7 days, M2.5+). Intensity at your location is a rough estimate from magnitude, depth and distance. For official PHIVOLCS intensity and bulletins see <a href="https://earthquake.phivolcs.dost.gov.ph" target="_blank" rel="noopener">earthquake.phivolcs.dost.gov.ph</a>.</p>
  `,
  styles: [`
    .hz-map { height: min(50vh, 420px); border-radius: 12px; border: 1px solid #e5e7eb; margin: .6rem 0; }
    .alert { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: .7rem 1rem; border-radius: 10px; margin-top: .6rem; }
    .qlist { display: flex; flex-direction: column; gap: .4rem; }
    .q { display: flex; gap: .7rem; align-items: center; padding: .55rem .7rem; border: 1px solid #e5e7eb; border-radius: 10px; text-decoration: none; color: inherit; }
    .mag { color: #fff; font-weight: 700; border-radius: 8px; padding: .35rem .5rem; min-width: 52px; text-align: center; }
    .info { display: flex; flex-direction: column; } small { color: #6b7280; }
    .muted { color: #6b7280; font-size: .85rem; }
  `],
})
export class EarthquakesComponent implements AfterViewInit, OnDestroy {
  private api = inject(HazardsApiService);
  private location = inject(LocationService);
  @ViewChild('map') mapEl!: ElementRef<HTMLElement>;
  @Input() lat: number | null = null;
  @Input() lon: number | null = null;
  quakes: Quake[] = [];
  loading = true;
  failed = false;
  alert = '';
  private map?: L.Map;
  private markers = new Map<string, L.CircleMarker>();

  get hasLoc() { return this.lat != null && this.lon != null; }
  roman(n: number) { return ROMAN[n] ?? ''; }
  feel(n: number) { return FEEL[n] ?? ''; }
  magColor(m: number) { return m >= 6 ? '#dc2626' : m >= 5 ? '#f97316' : m >= 4 ? '#eab308' : '#22c55e'; }

  async ngAfterViewInit() {
    if (!this.hasLoc) {
      try {
        const c = await this.location.getCurrentPosition();
        this.lat = c.latitude;
        this.lon = c.longitude;
      } catch { /* shows nearest-to-Philippines list without distances */ }
    }
    const c: L.LatLngExpression = this.hasLoc ? [this.lat!, this.lon!] : [12, 123];
    this.map = L.map(this.mapEl.nativeElement).setView(c, this.hasLoc ? 7 : 5);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 12, attribution: '© OpenStreetMap' }).addTo(this.map);
    if (this.hasLoc) L.circleMarker(c, { radius: 7, color: '#1d4ed8', fillColor: '#1d4ed8', fillOpacity: 1 }).bindTooltip('You').addTo(this.map);
    this.api.earthquakes(this.lat, this.lon).subscribe({
      next: (r) => {
        this.loading = false;
        this.failed = !!r.error;
        this.quakes = r.quakes ?? [];
        for (const q of this.quakes) {
          const m = L.circleMarker([q.latitude, q.longitude], {
            radius: 3 + q.magnitude * 1.6, color: this.magColor(q.magnitude), fillColor: this.magColor(q.magnitude), fillOpacity: 0.5,
          }).bindPopup(`<b>M${q.magnitude.toFixed(1)}</b> ${q.place}<br>Depth ${q.depthKm} km<br>${new Date(q.time).toLocaleString('en-PH')}`);
          m.addTo(this.map!);
          this.markers.set(q.id, m);
        }
        const recent = this.quakes.find((q) => q.distanceKm != null && q.distanceKm <= 150 && q.magnitude >= 4 && Date.now() - +new Date(q.time) < 86400000);
        if (recent) this.alert = `M${recent.magnitude.toFixed(1)} earthquake ${recent.distanceKm} km from you in the last 24 hours (depth ${recent.depthKm} km).`;
      },
      error: () => { this.loading = false; this.failed = true; },
    });
    setTimeout(() => this.map?.invalidateSize(), 200);
  }

  highlight(q: Quake) { this.markers.get(q.id)?.openPopup(); }
  ngOnDestroy() { this.map?.remove(); }
}
