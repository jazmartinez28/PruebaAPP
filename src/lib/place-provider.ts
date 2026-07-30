import type { City } from '@/data/cities';
import type { Category, Place, PriceTier } from '@/types';

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = { elements?: OverpassElement[] };

const CATEGORY_BY_TAG: Array<[string, string, Category[]]> = [
  ['tourism', 'museum', ['museos', 'arte']],
  ['tourism', 'gallery', ['arte']],
  ['tourism', 'attraction', ['iconico', 'fotografia']],
  ['tourism', 'viewpoint', ['fotografia', 'gratis']],
  ['tourism', 'artwork', ['arte', 'gratis']],
  ['historic', '*', ['historia', 'arquitectura']],
  ['amenity', 'theatre', ['arte', 'musica']],
  ['amenity', 'arts_centre', ['arte', 'local']],
  ['amenity', 'restaurant', ['gastronomia', 'local']],
  ['amenity', 'cafe', ['gastronomia', 'local']],
  ['amenity', 'marketplace', ['gastronomia', 'compras', 'local']],
  ['leisure', 'park', ['parques', 'naturaleza', 'gratis']],
  ['leisure', 'garden', ['parques', 'naturaleza']],
  ['leisure', 'sports_centre', ['deportes']],
  ['shop', 'mall', ['compras']],
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
  if (tags.amenity === 'restaurant') return 2;
  return 0;
}

function durationOf(tags: Record<string, string>): number {
  if (tags.tourism === 'museum') return 90;
  if (tags.tourism === 'attraction' || tags.historic) return 60;
  if (tags.leisure === 'park' || tags.leisure === 'garden') return 60;
  if (tags.amenity === 'restaurant') return 75;
  if (tags.amenity === 'cafe') return 45;
  return 45;
}

function zoneOf(tags: Record<string, string>, city: City): string {
  return (
    tags['addr:suburb'] ||
    tags['addr:district'] ||
    tags['addr:neighbourhood'] ||
    tags['is_in:suburb'] ||
    city.name
  );
}

function addressOf(tags: Record<string, string>): string | undefined {
  const street = tags['addr:street'];
  const number = tags['addr:housenumber'];
  return street ? `${street}${number ? ` ${number}` : ''}` : undefined;
}

export async function fetchCityPlaces(city: City, limit = 160): Promise<Place[]> {
  const query = `
    [out:json][timeout:28];
    (
      nwr(around:18000,${city.lat},${city.lng})["tourism"~"museum|gallery|attraction|viewpoint|artwork"]["name"];
      nwr(around:18000,${city.lat},${city.lng})["historic"]["name"];
      nwr(around:18000,${city.lat},${city.lng})["amenity"~"theatre|arts_centre|restaurant|cafe|marketplace"]["name"];
      nwr(around:18000,${city.lat},${city.lng})["leisure"~"park|garden|sports_centre"]["name"];
      nwr(around:18000,${city.lat},${city.lng})["natural"]["name"];
    );
    out center tags ${Math.max(limit * 2, 260)};
  `;

  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!response.ok) throw new Error(`OpenStreetMap respondió ${response.status}`);
  const payload = (await response.json()) as OverpassResponse;
  const seen = new Set<string>();

  return (payload.elements ?? [])
    .map((element): Place | null => {
      const tags = element.tags ?? {};
      const name = tags.name || tags['name:es'] || tags['name:en'];
      const lat = element.lat ?? element.center?.lat;
      const lng = element.lon ?? element.center?.lon;
      if (!name || lat == null || lng == null) return null;
      const key = name.trim().toLocaleLowerCase();
      if (seen.has(key)) return null;
      seen.add(key);
      const categories = categoriesOf(tags);
      const isMeal = tags.amenity === 'restaurant' || tags.amenity === 'cafe';
      const officialUrl = tags.website || tags['contact:website'];
      return {
        id: `osm-${element.type}-${element.id}`,
        cityId: city.id,
        name: name.trim(),
        categories,
        lat,
        lng,
        zone: zoneOf(tags, city),
        durationMin: durationOf(tags),
        price: priceOf(tags),
        rating: tags.wikipedia || tags.wikidata ? 4.4 : 4.1,
        desc:
          tags.description ||
          `${categories.includes('gastronomia') ? 'Propuesta gastronómica' : 'Lugar de interés'} en ${zoneOf(tags, city)}.`,
        reason: 'Sumado desde la comunidad de OpenStreetMap por afinidad y cercanía.',
        openFrom: tags.opening_hours ? undefined : undefined,
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
    .sort((a, b) => Number(Boolean(b.officialUrl)) - Number(Boolean(a.officialUrl)) || b.rating - a.rating)
    .slice(0, limit);
}

export type GeocodedAccommodation = {
  name: string;
  address: string;
  lat: number;
  lng: number;
};

export async function geocodeAccommodation(
  query: string,
  city: City,
): Promise<GeocodedAccommodation[]> {
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
  const results = (await response.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
    name?: string;
  }>;
  return results.map((result) => ({
    name: result.name || query,
    address: result.display_name,
    lat: Number(result.lat),
    lng: Number(result.lon),
  }));
}
