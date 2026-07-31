import type { City } from '@/data/cities';
import type { Category, Place, PriceTier } from '@/types';
import { Platform } from 'react-native';

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = { elements?: OverpassElement[] };

const OVERPASS_ENDPOINTS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

const CATEGORY_BY_TAG: [string, string, Category[]][] = [
  ['tourism', 'museum', ['museos', 'arte']],
  ['tourism', 'gallery', ['arte']],
  ['tourism', 'attraction', ['iconico', 'fotografia']],
  ['tourism', 'viewpoint', ['fotografia', 'gratis']],
  ['tourism', 'artwork', ['arte', 'gratis']],
  ['tourism', 'zoo', ['naturaleza', 'local']],
  ['tourism', 'aquarium', ['naturaleza', 'local']],
  ['tourism', 'theme_park', ['local']],
  ['historic', '*', ['historia', 'arquitectura']],
  ['amenity', 'theatre', ['arte', 'musica']],
  ['amenity', 'arts_centre', ['arte', 'local']],
  ['amenity', 'restaurant', ['gastronomia', 'local']],
  ['amenity', 'cafe', ['gastronomia', 'local']],
  ['amenity', 'marketplace', ['gastronomia', 'compras', 'local']],
  ['amenity', 'bar', ['vidanocturna', 'gastronomia']],
  ['amenity', 'pub', ['vidanocturna', 'gastronomia']],
  ['amenity', 'nightclub', ['vidanocturna', 'musica']],
  ['amenity', 'cinema', ['arte', 'local']],
  ['amenity', 'music_venue', ['musica', 'vidanocturna']],
  ['amenity', 'place_of_worship', ['historia', 'arquitectura']],
  ['amenity', 'library', ['historia', 'arquitectura']],
  ['amenity', 'food_court', ['gastronomia', 'local']],
  ['amenity', 'fast_food', ['gastronomia']],
  ['leisure', 'park', ['parques', 'naturaleza', 'gratis']],
  ['leisure', 'garden', ['parques', 'naturaleza']],
  ['leisure', 'sports_centre', ['deportes']],
  ['leisure', 'stadium', ['deportes', 'iconico']],
  ['leisure', 'nature_reserve', ['naturaleza', 'fotografia']],
  ['leisure', 'water_park', ['naturaleza', 'local']],
  ['leisure', 'marina', ['naturaleza', 'fotografia']],
  ['leisure', 'beach_resort', ['naturaleza', 'local']],
  ['leisure', 'bowling_alley', ['deportes', 'vidanocturna']],
  ['leisure', 'escape_game', ['local']],
  ['shop', 'mall', ['compras']],
  ['shop', 'department_store', ['compras']],
  ['shop', 'books', ['compras', 'local']],
  ['shop', 'antiques', ['compras', 'historia']],
  ['shop', 'art', ['compras', 'arte']],
  ['shop', 'souvenir', ['compras', 'local']],
  ['man_made', 'tower', ['arquitectura', 'fotografia']],
  ['man_made', 'lighthouse', ['arquitectura', 'fotografia']],
  ['route', 'walking', ['naturaleza', 'local']],
  ['route', 'hiking', ['naturaleza', 'deportes']],
  ['route', 'bicycle', ['naturaleza', 'deportes']],
  ['natural', '*', ['naturaleza', 'fotografia']],
];

function categoriesOf(tags: Record<string, string>): Category[] {
  for (const [key, value, categories] of CATEGORY_BY_TAG) {
    if (tags[key] && (value === '*' || tags[key] === value)) return categories;
  }
  return ['local'];
}

function priceOf(tags: Record<string, string>): PriceTier {
  if (tags.fee === 'no' || tags.charge === '0') return 0;
  if (tags.charge || tags.fee === 'yes') return 1;
  if (['restaurant', 'bar', 'nightclub'].includes(tags.amenity)) return 2;
  return 0;
}

function durationOf(tags: Record<string, string>): number {
  if (tags.tourism === 'museum') return 90;
  if (tags.tourism === 'attraction' || tags.historic) return 60;
  if (tags.leisure === 'park' || tags.leisure === 'garden') return 60;
  if (tags.amenity === 'restaurant') return 75;
  if (tags.amenity === 'cafe' || tags.amenity === 'fast_food') return 45;
  if (['theatre', 'cinema', 'music_venue'].includes(tags.amenity)) return 120;
  if (['bar', 'pub', 'nightclub'].includes(tags.amenity)) return 90;
  if (tags.route) return 120;
  return 45;
}

function zoneOf(tags: Record<string, string>, city: City): string {
  return tags['addr:suburb'] || tags['addr:district'] || tags['addr:neighbourhood'] || tags['is_in:suburb'] || city.name;
}

function addressOf(tags: Record<string, string>): string | undefined {
  const street = tags['addr:street'];
  const number = tags['addr:housenumber'];
  return street ? `${street}${number ? ` ${number}` : ''}` : undefined;
}

function catalogGroup(place: Place): string {
  if (place.isMeal) return 'gastronomia';
  if (place.categories.includes('museos') || place.categories.includes('arte')) return 'cultura';
  if (place.categories.includes('historia') || place.categories.includes('arquitectura')) return 'historia';
  if (place.categories.includes('naturaleza') || place.categories.includes('parques')) return 'naturaleza';
  if (place.categories.includes('compras')) return 'compras';
  if (place.categories.includes('vidanocturna') || place.categories.includes('musica')) return 'nocturna';
  if (place.categories.includes('deportes')) return 'deportes';
  return 'local';
}

function diversify(places: Place[], limit: number): Place[] {
  const buckets = new Map<string, Place[]>();
  places.forEach((place) => {
    const group = catalogGroup(place);
    buckets.set(group, [...(buckets.get(group) ?? []), place]);
  });
  const result: Place[] = [];
  while (result.length < limit && [...buckets.values()].some((bucket) => bucket.length)) {
    buckets.forEach((bucket) => {
      const next = bucket.shift();
      if (next && result.length < limit) result.push(next);
    });
  }
  return result;
}

async function requestOverpass(query: string): Promise<OverpassResponse> {
  let lastError: unknown;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      };
      if (Platform.OS !== 'web') headers['User-Agent'] = 'Rumbo travel planner mobile app';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`OpenStreetMap respondió ${response.status}`);
      return (await response.json()) as OverpassResponse;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('No pudimos ampliar el catálogo ahora.');
}

export async function fetchCityPlaces(city: City, limit = 360): Promise<Place[]> {
  const radius = 12000;
  const latDelta = radius / 111320;
  const lngDelta = radius / (111320 * Math.cos((city.lat * Math.PI) / 180));
  const bounds = `${city.lat - latDelta},${city.lng - lngDelta},${city.lat + latDelta},${city.lng + lngDelta}`;
  const queryGroups = [
    [
      `nwr(${bounds})["tourism"~"museum|gallery|attraction|viewpoint|artwork|zoo|aquarium|theme_park"]["name"];`,
      `nwr(${bounds})["historic"]["name"];`,
      `nwr(${bounds})["leisure"~"park|garden|sports_centre|stadium|nature_reserve|water_park|marina|beach_resort"]["name"];`,
      `nwr(${bounds})["natural"]["name"];`,
      `nwr(${bounds})["man_made"~"tower|lighthouse"]["name"];`,
    ],
    [
      `nwr(${bounds})["amenity"~"theatre|arts_centre|restaurant|cafe|marketplace|bar|pub|nightclub|cinema|library|place_of_worship|music_venue|food_court|fast_food"]["name"];`,
      `nwr(${bounds})["leisure"~"bowling_alley|escape_game"]["name"];`,
    ],
    [
      `nwr(${bounds})["shop"~"mall|department_store|books|antiques|art|souvenir"]["name"];`,
      `nwr(${bounds})["route"~"walking|hiking|bicycle"]["name"];`,
    ],
  ];
  const payloads: OverpassResponse[] = [];
  for (const statements of queryGroups) {
    const query = `[out:json][timeout:12];(${statements.join('')});out tags center ${Math.max(limit * 2, 720)};`;
    try {
      payloads.push(await requestOverpass(query));
    } catch {
      // Otro grupo puede aportar suficientes opciones; conservamos resultados parciales.
    }
  }
  if (!payloads.length) throw new Error('No pudimos ampliar el catálogo ahora.');
  const seen = new Set<string>();

  const places = payloads.flatMap((payload) => payload.elements ?? [])
    .map((element): Place | null => {
      const tags = element.tags ?? {};
      const name = tags['name:es'] || tags.name || tags['name:en'];
      const lat = element.lat ?? element.center?.lat;
      const lng = element.lon ?? element.center?.lon;
      if (!name || lat == null || lng == null) return null;
      const key = name.trim().toLocaleLowerCase();
      if (seen.has(key)) return null;
      seen.add(key);
      const categories = categoriesOf(tags);
      const isMeal = ['restaurant', 'cafe', 'food_court', 'fast_food'].includes(tags.amenity);
      const officialUrl = tags.website || tags['contact:website'];
      const zone = zoneOf(tags, city);
      return {
        id: `osm-${element.type}-${element.id}`,
        cityId: city.id,
        name: name.trim(),
        categories,
        lat,
        lng,
        zone,
        durationMin: durationOf(tags),
        price: priceOf(tags),
        rating: tags.wikipedia || tags.wikidata ? 4.4 : 4.1,
        desc: tags.description || `${categories.includes('gastronomia') ? 'Propuesta gastronómica' : 'Lugar de interés'} en ${zone}.`,
        reason: 'Sumado desde la comunidad de OpenStreetMap por afinidad y cercanía.',
        needsBooking: tags.reservation === 'required' || tags.booking === 'yes',
        confident: false,
        isMeal,
        address: addressOf(tags),
        officialUrl,
        bookingUrl: tags['contact:booking'] || officialUrl,
        source: 'openstreetmap',
        sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
      };
    })
    .filter((place): place is Place => Boolean(place))
    .sort((a, b) => Number(Boolean(b.officialUrl)) - Number(Boolean(a.officialUrl)) || b.rating - a.rating);

  return diversify(places, limit);
}

export type GeocodedAccommodation = {
  name: string;
  address: string;
  lat: number;
  lng: number;
};

export async function geocodeAccommodation(query: string, city: City): Promise<GeocodedAccommodation[]> {
  const params = new URLSearchParams({
    q: `${query}, ${city.name}, ${city.country}`,
    format: 'jsonv2',
    limit: '5',
    addressdetails: '1',
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: { 'Accept-Language': 'es' },
  });
  if (!response.ok) throw new Error('No pudimos buscar esa dirección');
  const results = (await response.json()) as { display_name: string; lat: string; lon: string; name?: string }[];
  return results.map((result) => ({
    name: result.name || query,
    address: result.display_name,
    lat: Number(result.lat),
    lng: Number(result.lon),
  }));
}
