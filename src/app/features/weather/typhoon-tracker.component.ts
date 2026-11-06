import { AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { HazardsApiService, Typhoon } from '../../core/services/weather-api.service';

const COLORS: Record<string, string> = {
  'Tropical Depression': '#38bdf8',
  'Tropical Storm': '#22c55e',
  'Severe Tropical Storm': '#eab308',
  'Typhoon': '#f97316',
  'Super Typhoon': '#dc2626',
  'Unknown': '#6b7280',
};

@Component({
  selector: 'app-typhoon-tracker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div #map class="hz-map"></div>
    <div class="legend">
      @for (c of cats; track c) { <span><i [style.background]="color(c)"></i>{{ c }}</span> }
      <span>Solid line = past track · Dashed = forecast</span>
    </div>
    @if (loading) { <p class="muted">Loading storm data…</p> }
    @else if (failed) { <p class="muted">Storm data is unavailable right now. Please try again later or use the official links below.</p> }
    @else if (!storms.length) { <p class="ok">No active tropical cyclone in the Western Pacific right now.</p> }
    @for (t of storms; track t.id) {
      <div class="storm" (click)="focus(t)">
        <b>{{ t.name }}</b>
        <span class="chip" [style.background]="color(t.category)">{{ t.category }}</span>
        <span>{{ t.windKph ?? '–' }} km/h winds</span>
        <small>Tap a dot on the map for time, speed and pressure.</small>
      </div>
    }
    <p class="muted">Tracks from GDACS (JTWC/NOAA data). Strength labels use PAGASA's wind scale, but PAGASA's own names and signal numbers can differ — always follow the official PAGASA bulletin.</p>
  `,
  styles: [`
    .hz-map { height: min(62vh, 520px); border-radius: 12px; border: 1px solid #e5e7eb; }
    .legend { display: flex; flex-wrap: wrap; gap: .3rem .9rem; font-size: .8rem; margin: .6rem 0; }
    .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; }
    .storm { display: flex; flex-wrap: wrap; gap: .6rem; align-items: center; padding: .6rem .8rem; border: 1px solid #e5e7eb; border-radius: 10px; margin-bottom: .5rem; cursor: pointer; }
    .chip { color: #fff; border-radius: 999px; padding: .1rem .6rem; font-size: .8rem; }
    .muted { color: #6b7280; font-size: .85rem; } .ok { color: #166534; }
  `],
})
export class TyphoonTrackerComponent implements AfterViewInit, OnDestroy {
  private api = inject(HazardsApiService);
  @ViewChild('map') mapEl!: ElementRef<HTMLElement>;
  @Input() lat: number | null = null;
  @Input() lon: number | null = null;
  cats = Object.keys(COLORS).filter((c) => c !== 'Unknown');
  storms: Typhoon[] = [];
  loading = true;
  failed = false;
  private map?: L.Map;
  private layer = L.layerGroup();

  color(c: string) { return COLORS[c] ?? COLORS['Unknown']; }

  ngAfterViewInit() {
    this.map = L.map(this.mapEl.nativeElement, { zoomControl: true }).setView([13, 125], 5);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 10, attribution: '© OpenStreetMap' }).addTo(this.map);
    this.layer.addTo(this.map);
    if (this.lat != null && this.lon != null) {
      L.circleMarker([this.lat, this.lon], { radius: 7, color: '#1d4ed8', fillColor: '#1d4ed8', fillOpacity: 1 }).bindTooltip('You').addTo(this.map);
    }
    this.api.typhoons().subscribe({
      next: (r) => {
        this.loading = false;
        this.failed = !!r.error;
        this.storms = (r.typhoons ?? []).filter((t) => t.points.some((p) => p.longitude > 95 && p.longitude < 180 && p.latitude > 0 && p.latitude < 45));
        this.draw();
      },
      error: () => { this.loading = false; this.failed = true; },
    });
    setTimeout(() => this.map?.invalidateSize(), 200);
  }

  private fmt(t: string | null) {
    if (!t) return '';
    const d = new Date(t);
    return isNaN(+d) ? t : d.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', hour12: true });
  }

  private draw() {
    this.layer.clearLayers();
    const all: L.LatLngExpression[] = [];
    for (const t of this.storms) {
      const pts = t.points;
      const past = pts.filter((p) => !p.forecast);
      const fc = pts.filter((p) => p.forecast);
      const ll = (p: any) => [p.latitude, p.longitude] as L.LatLngExpression;
      if (past.length > 1) L.polyline(past.map(ll), { color: '#111827', weight: 3 }).addTo(this.layer);
      const join = past.length ? [past[past.length - 1], ...fc] : fc;
      if (join.length > 1) L.polyline(join.map(ll), { color: '#111827', weight: 2, dashArray: '6 6' }).addTo(this.layer);
      pts.forEach((p, i) => {
        all.push(ll(p));
        const m = L.circleMarker(ll(p), {
          radius: p.forecast ? 6 : 5, color: '#111827', weight: 1, fillColor: this.color(p.category), fillOpacity: p.forecast ? 0.7 : 1,
        }).bindPopup(
          `<b>${t.name}</b><br>${p.forecast ? 'Forecast' : 'Observed'}: ${this.fmt(p.time)}<br>` +
            `${p.category}<br>Wind: ${p.windKph ?? '–'} km/h${p.gustKph ? ' (gusts ' + p.gustKph + ')' : ''}` +
            `${p.pressure ? '<br>Pressure: ' + p.pressure + ' hPa' : ''}`,
        );
        if (p.forecast && p.time) m.bindTooltip(this.fmt(p.time), { permanent: i % 2 === 0, direction: 'top', opacity: 0.8 });
        m.addTo(this.layer);
      });
      const cur = past[past.length - 1] ?? pts[0];
      L.marker(ll(cur), {
        icon: L.divIcon({ className: '', html: `<div style="background:#111827;color:#fff;padding:2px 6px;border-radius:6px;font-size:12px;white-space:nowrap;transform:translate(8px,-24px)">${t.name}</div>` }),
      }).addTo(this.layer);
    }
    if (all.length) this.map?.fitBounds(L.latLngBounds(all), { padding: [30, 30], maxZoom: 7 });
  }

  focus(t: Typhoon) {
    const pts = t.points.map((p) => [p.latitude, p.longitude] as L.LatLngExpression);
    if (pts.length) this.map?.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 7 });
  }

  ngOnDestroy() { this.map?.remove(); }
}
