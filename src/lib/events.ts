import type { City } from '@/data/cities';
import { REMOTE_CONFIG } from '@/constants/config';
import type { Category, Place, PriceTier } from '@/types';

type TMEvent = {
  id: string;
  name: string;
  url?: string;
  info?: string;
  pleaseNote?: string;
  images?: { url: string; width: number; height: number; ratio?: string }[];
  dates?: {
    start?: { localDate?: string; localTime?: string; dateTBD?: boolean; timeTBA?: boolean };
    status?: { code?: string };
  };
  priceRanges?: { min?: number; max?: number; currency?: string }[];
  classifications?: { segment?: { name?: string }; genre?: { name?: string } }[];
  _embedded?: {
    venues?: {
      name?: string;
      address?: { line1?: string };
      city?: { name?: string };
      location?: { latitude?: string; longitude?: string };
    }[];
  };
};

type TMResponse = { _embedded?: { events?: TMEvent[] } };

const toMin = (value?: string) => {
  if (!value || !/^\d{2}:\d{2}/.test(value)) return undefined;
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
};

function eventCategory(event: TMEvent): Category {
  const classification = `${event.classifications?.[0]?.segment?.name ?? ''} ${event.classifications?.[0]?.genre?.name ?? ''}`.toLowerCase();
  if (classification.includes('sport')) return 'deportes';
  if (classification.includes('music')) return 'musica';
  if (classification.includes('food') || classification.includes('gastronom')) return 'gastronomia';
  if (classification.includes('art') || classification.includes('theatre') || classification.includes('theater')) return 'arte';
  return 'local';
}

function priceTier(event: TMEvent): PriceTier {
  const min = event.priceRanges?.[0]?.min;
  if (min == null) return 1;
  if (min <= 10) return 0;
  if (min <= 40) return 1;
  if (min <= 120) return 2;
  return 3;
}

function durationFor(category: Category) {
  if (category === 'deportes') return 150;
  if (category === 'musica') return 180;
  return 120;
}

/** Carga eventos reales de Ticketmaster dentro de las fechas exactas del viaje. */
export async function fetchTripEvents(city: City, startDate: string, endDate: string): Promise<Place[]> {
  const apiKey = process.env.EXPO_PUBLIC_TICKETMASTER_API_KEY;
  if (!apiKey) throw new Error('Configurá EXPO_PUBLIC_TICKETMASTER_API_KEY para descubrir eventos reales.');

  const params = new URLSearchParams({
    apikey: apiKey,
    city: city.name,
    countryCode: city.countryCode,
    startDateTime: `${startDate}T00:00:00Z`,
    endDateTime: `${endDate}T23:59:59Z`,
    size: String(REMOTE_CONFIG.liveEventsPerTrip),
    sort: 'date,asc',
    locale: '*',
  });
  const response = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params.toString()}`);
  if (!response.ok) throw new Error(response.status === 401 ? 'La clave de eventos no es válida.' : 'No pudimos consultar los eventos ahora.');
  const payload = (await response.json()) as TMResponse;

  return (payload._embedded?.events ?? []).flatMap((event) => {
    const date = event.dates?.start?.localDate;
    const venue = event._embedded?.venues?.[0];
    const lat = Number(venue?.location?.latitude);
    const lng = Number(venue?.location?.longitude);
    if (!date || date < startDate || date > endDate || !Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    const category = eventCategory(event);
    const startMin = toMin(event.dates?.start?.localTime);
    const image = event.images
      ?.filter((candidate) => candidate.width >= 600)
      .sort((a, b) => Math.abs(a.width / a.height - 16 / 9) - Math.abs(b.width / b.height - 16 / 9))[0];
    const status = event.dates?.status?.code;
    return [{
      id: `event-${event.id}`,
      cityId: city.id,
      name: event.name,
      categories: [category],
      lat,
      lng,
      zone: venue?.name ?? city.name,
      durationMin: durationFor(category),
      price: priceTier(event),
      rating: 0,
      desc: event.info || event.pleaseNote || `Evento confirmado durante tu viaje a ${city.name}.`,
      reason: 'Coincide con las fechas y preferencias de tu viaje.',
      confident: !event.dates?.start?.dateTBD && !event.dates?.start?.timeTBA && startMin != null,
      address: [venue?.address?.line1, venue?.city?.name].filter(Boolean).join(', ') || venue?.name,
      officialUrl: event.url,
      bookingUrl: event.url,
      imageUrl: image?.url,
      kind: 'event' as const,
      eventDate: date,
      eventStartMin: startMin,
      availability: status === 'onsale' ? 'onsale' as const : status === 'offsale' ? 'offsale' as const : 'unknown' as const,
      ticketRequirement: 'required' as const,
      needsBooking: true,
      source: 'ticketmaster' as const,
      sourceUrl: event.url,
    }];
  });
}
