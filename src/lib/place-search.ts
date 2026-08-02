import type { City } from '@/data/cities';
import type { Category, Place, PriceTier } from '@/types';

type ProviderItem = {
  id: string;
  name: string;
  category?: string;
  address?: string;
  zone?: string;
  lat: number;
  lng: number;
  rating?: number;
  price?: number;
  website?: string;
  imageUrl?: string;
};

type ProviderResponse = {
  items?: ProviderItem[];
  code?: 'provider_unconfigured' | 'provider_error';
  message?: string;
};

export class PlaceSearchError extends Error {
  code: 'unconfigured' | 'network' | 'provider';

  constructor(code: PlaceSearchError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

function categoryFromProvider(label = ''): Category[] {
  const value = label.toLocaleLowerCase();
  if (/restaurant|food|caf|bakery|barbecue|pizza|comida|restaurante/.test(value)) return ['gastronomia', 'local'];
  if (/museum|gallery|art|museo|galer/.test(value)) return ['museos', 'arte'];
  if (/park|garden|natural|parque|jard/.test(value)) return ['parques', 'naturaleza'];
  if (/night|club|bar|pub|music|teatro|theatre/.test(value)) return ['vidanocturna', 'musica'];
  if (/shop|store|market|mall|tienda|mercado/.test(value)) return ['compras', 'local'];
  if (/historic|monument|landmark|church|temple|hist/.test(value)) return ['historia', 'arquitectura'];
  if (/sport|stadium|gym/.test(value)) return ['deportes'];
  return ['local', 'iconico'];
}

function endpointFor(path: string) {
  const configured = process.env.EXPO_PUBLIC_PLACES_API_URL?.replace(/\/$/, '');
  return configured ? `${configured}${path}` : path;
}

export async function searchDestinationPlaces(
  query: string,
  city: City,
  signal?: AbortSignal,
): Promise<Place[]> {
  const params = new URLSearchParams({
    q: query.trim(),
    cityId: city.id,
    city: city.name,
    country: city.country,
    lat: String(city.lat),
    lng: String(city.lng),
  });

  let response: Response;
  try {
    response = await fetch(endpointFor(`/api/places/search?${params.toString()}`), {
      headers: { Accept: 'application/json' },
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new PlaceSearchError('network', 'No pudimos conectar con la búsqueda global.');
  }

  let payload: ProviderResponse;
  try {
    payload = (await response.json()) as ProviderResponse;
  } catch {
    throw new PlaceSearchError(
      'unconfigured',
      'La búsqueda global necesita conectar el proveedor de lugares.',
    );
  }

  if (response.status === 503 || payload.code === 'provider_unconfigured') {
    throw new PlaceSearchError('unconfigured', payload.message ?? 'El proveedor de lugares todavía no está configurado.');
  }
  if (!response.ok) {
    throw new PlaceSearchError('provider', payload.message ?? 'El proveedor no pudo completar la búsqueda.');
  }

  return (payload.items ?? [])
    .filter((item) => item.name && Number.isFinite(item.lat) && Number.isFinite(item.lng))
    .map((item) => ({
      id: `fsq-${item.id}`,
      cityId: city.id,
      name: item.name,
      categories: categoryFromProvider(item.category),
      lat: item.lat,
      lng: item.lng,
      zone: item.zone || city.name,
      durationMin: /restaurant|food|caf|bar/i.test(item.category ?? '') ? 75 : 60,
      price: Math.max(0, Math.min(3, item.price ?? 1)) as PriceTier,
      rating: item.rating && item.rating > 5 ? item.rating / 2 : item.rating ?? 0,
      desc: item.category ? `${item.category} en ${item.zone || city.name}.` : `Lugar en ${city.name}.`,
      reason: 'Encontrado para tu destino mediante búsqueda global.',
      address: item.address,
      officialUrl: item.website,
      bookingUrl: item.website,
      imageUrl: item.imageUrl,
      confident: true,
      isMeal: /restaurant|food|caf|bakery|barbecue|pizza/i.test(item.category ?? ''),
      source: 'foursquare',
      sourceUrl: item.website,
    }));
}
