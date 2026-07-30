import { distanceM, fmtDist } from '@/lib/geo';
import type { Place } from '@/types';

export type TransportMode = 'walk' | 'transit' | 'taxi';

export type TransportOption = {
  mode: TransportMode;
  label: string;
  detail: string;
  minutes: number;
  recommended: boolean;
  icon: 'walk-outline' | 'bus-outline' | 'car-outline';
  directionsUrl: string;
};

const TRANSIT_LABEL: Record<string, string> = {
  roma: 'Metro o colectivo',
  paris: 'Métro o bus',
  barcelona: 'Metro o bus',
  buenosaires: 'Subte o colectivo',
  nuevayork: 'Subway o bus',
  tokio: 'Tren o metro',
};

function directionsUrl(from: Place, to: Place, mode: 'walking' | 'transit' | 'driving') {
  const params = new URLSearchParams({
    api: '1',
    origin: `${from.lat},${from.lng}`,
    destination: `${to.lat},${to.lng}`,
    travelmode: mode,
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function transportOptions(cityId: string, from: Place, to: Place): TransportOption[] {
  const meters = Math.round(distanceM(from, to));
  const walkMinutes = Math.max(2, Math.round((meters / 4500) * 60));
  const transitMinutes = Math.max(8, Math.round((meters / 19000) * 60) + 7);
  const taxiMinutes = Math.max(5, Math.round((meters / 24000) * 60) + 4);
  const recommendWalk = meters <= 1400;
  const recommendTransit = meters > 1400 && meters <= 8500;

  return [
    {
      mode: 'walk',
      label: 'A pie',
      detail: `${fmtDist(meters)} · sin esperas`,
      minutes: walkMinutes,
      recommended: recommendWalk,
      icon: 'walk-outline',
      directionsUrl: directionsUrl(from, to, 'walking'),
    },
    {
      mode: 'transit',
      label: TRANSIT_LABEL[cityId] ?? 'Transporte público',
      detail: 'Abrí la ruta para ver línea, parada y salidas en tiempo real',
      minutes: transitMinutes,
      recommended: recommendTransit,
      icon: 'bus-outline',
      directionsUrl: directionsUrl(from, to, 'transit'),
    },
    {
      mode: 'taxi',
      label: 'Taxi o auto',
      detail: `${fmtDist(meters)} · estimación sin tráfico en vivo`,
      minutes: taxiMinutes,
      recommended: !recommendWalk && !recommendTransit,
      icon: 'car-outline',
      directionsUrl: directionsUrl(from, to, 'driving'),
    },
  ];
}

export function recommendedTransport(cityId: string, from: Place, to: Place) {
  return transportOptions(cityId, from, to).find((option) => option.recommended)!;
}
