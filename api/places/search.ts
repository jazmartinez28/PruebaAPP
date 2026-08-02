type RequestLike = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
};

type FoursquarePhoto = { prefix?: string; suffix?: string };
type FoursquarePlace = {
  fsq_place_id?: string;
  fsq_id?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  geocodes?: { main?: { latitude?: number; longitude?: number } };
  categories?: { name?: string }[];
  address?: string;
  locality?: string;
  location?: { formatted_address?: string; locality?: string; neighborhood?: string[] };
  rating?: number;
  price?: number;
  website?: string;
  photos?: FoursquarePhoto[];
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(request: RequestLike, response: ResponseLike) {
  if (request.method && request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({ message: 'Método no permitido.' });
    return;
  }

  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey) {
    response.status(503).json({
      code: 'provider_unconfigured',
      message: 'Configurá FOURSQUARE_API_KEY en Vercel para activar la búsqueda global.',
    });
    return;
  }

  const query = single(request.query.q)?.trim() ?? '';
  const lat = Number(single(request.query.lat));
  const lng = Number(single(request.query.lng));
  if (query.length < 2 || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    response.status(400).json({ message: 'La búsqueda o el destino no son válidos.' });
    return;
  }

  const params = new URLSearchParams({
    query,
    ll: `${lat},${lng}`,
    radius: '25000',
    limit: '16',
    sort: 'RELEVANCE',
  });

  try {
    const providerResponse = await fetch(`https://places-api.foursquare.com/places/search?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-Places-Api-Version': '2025-06-17',
      },
    });
    const payload = (await providerResponse.json()) as { results?: FoursquarePlace[]; places?: FoursquarePlace[] };
    if (!providerResponse.ok) {
      response.status(providerResponse.status).json({ code: 'provider_error', message: 'El proveedor rechazó la búsqueda.' });
      return;
    }

    const items = (payload.results ?? payload.places ?? []).flatMap((place) => {
      const id = place.fsq_place_id ?? place.fsq_id;
      const latitude = place.latitude ?? place.geocodes?.main?.latitude;
      const longitude = place.longitude ?? place.geocodes?.main?.longitude;
      if (!id || !place.name || latitude == null || longitude == null) return [];
      const photo = place.photos?.[0];
      return [{
        id,
        name: place.name,
        category: place.categories?.[0]?.name,
        address: place.address ?? place.location?.formatted_address,
        zone: place.locality ?? place.location?.neighborhood?.[0] ?? place.location?.locality,
        lat: latitude,
        lng: longitude,
        rating: place.rating,
        price: place.price,
        website: place.website,
        imageUrl: photo?.prefix && photo.suffix ? `${photo.prefix}800x600${photo.suffix}` : undefined,
      }];
    });

    response.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
    response.status(200).json({ items });
  } catch {
    response.status(502).json({ code: 'provider_error', message: 'No pudimos consultar lugares en este momento.' });
  }
}
