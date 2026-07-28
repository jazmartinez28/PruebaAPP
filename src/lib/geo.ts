import type { Place } from '@/types';

type Pt = { lat: number; lng: number };

/** Distancia en metros entre dos coordenadas (haversine). */
export function distanceM(a: Pt, b: Pt): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function centroid(pts: Pt[]): Pt {
  const n = pts.length || 1;
  return {
    lat: pts.reduce((s, p) => s + p.lat, 0) / n,
    lng: pts.reduce((s, p) => s + p.lng, 0) / n,
  };
}

export type Leg = {
  mode: 'walk' | 'transit';
  meters: number;
  minutes: number;
  label: string;
};

/** Tramo entre dos puntos: caminando si es cerca, transporte si es lejos. */
export function legBetween(a: Pt, b: Pt): Leg {
  const m = Math.round(distanceM(a, b));
  if (m <= 1600) {
    const minutes = Math.max(2, Math.round((m / 4500) * 60)); // ~4.5 km/h
    return { mode: 'walk', meters: m, minutes, label: `${minutes} min a pie · ${fmtDist(m)}` };
  }
  const minutes = Math.max(8, Math.round((m / 18000) * 60) + 7); // ~18 km/h + espera
  return { mode: 'transit', meters: m, minutes, label: `${minutes} min en transporte · ${fmtDist(m)}` };
}

export function fmtDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

/** minutos-desde-medianoche -> "09:30" */
export function minToHHMM(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = Math.round(min % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function placePt(p: Place): Pt {
  return { lat: p.lat, lng: p.lng };
}
