import AsyncStorage from '@react-native-async-storage/async-storage';

import { cityById } from '@/data/cities';
import type { Place } from '@/types';

type WikiPage = {
  pageid?: number;
  title?: string;
  thumbnail?: { source?: string };
  coordinates?: { lat: number; lon: number }[];
};

type WikiResponse = { query?: { pages?: Record<string, WikiPage> } };
type WikidataResponse = {
  entities?: Record<string, { claims?: { P18?: { mainsnak?: { datavalue?: { value?: string } } }[] } }>;
};

const CACHE_PREFIX = '@rumbo/place-image/v2/';
const memory = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();
const queue: (() => void)[] = [];
let activeRequests = 0;

function normalized(value = '') {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lon: number }) {
  const radius = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function relevance(page: WikiPage, place: Place) {
  const title = normalized(page.title);
  const name = normalized(place.name.replace(/\([^)]*\)/g, ''));
  const words = name.split(' ').filter((word) => word.length > 2);
  const overlap = words.filter((word) => title.includes(word)).length;
  const exact = title === name ? 900 : title.includes(name) || name.includes(title) ? 420 : 0;
  const coordinates = page.coordinates?.[0];
  const proximity = coordinates ? Math.max(-300, 180 - distanceKm(place, coordinates) * 24) : 0;
  return exact + overlap * 85 + proximity;
}

async function withRequestSlot<T>(task: () => Promise<T>): Promise<T> {
  if (activeRequests >= 3) await new Promise<void>((resolve) => queue.push(resolve));
  activeRequests += 1;
  try {
    return await task();
  } finally {
    activeRequests -= 1;
    queue.shift()?.();
  }
}

async function requestWikipedia(place: Place, language: string, exactTitle?: string) {
  const city = cityById(place.cityId);
  const params = new URLSearchParams({
    action: 'query',
    prop: 'pageimages|coordinates',
    piprop: 'thumbnail',
    pithumbsize: '1200',
    format: 'json',
    origin: '*',
  });
  if (exactTitle) {
    params.set('titles', exactTitle);
  } else {
    params.set('generator', 'search');
    params.set('gsrsearch', `${place.name} ${city?.name ?? place.zone}`);
    params.set('gsrnamespace', '0');
    params.set('gsrlimit', '5');
  }

  const response = await fetch(`https://${language}.wikipedia.org/w/api.php?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as WikiResponse;
  const candidates = Object.values(payload.query?.pages ?? {})
    .filter((page) => page.thumbnail?.source?.startsWith('https://'))
    .sort((a, b) => relevance(b, place) - relevance(a, place));
  const best = candidates[0];
  if (!best?.thumbnail?.source) return null;
  if (!exactTitle && relevance(best, place) < 120) return null;
  return best.thumbnail.source;
}

async function requestWikidataImage(entityId: string) {
  const params = new URLSearchParams({
    action: 'wbgetentities',
    ids: entityId,
    props: 'claims',
    format: 'json',
    origin: '*',
  });
  const response = await fetch(`https://www.wikidata.org/w/api.php?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as WikidataResponse;
  const fileName = payload.entities?.[entityId]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  return fileName
    ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=1200`
    : null;
}

async function resolveUncached(place: Place) {
  if (place.wikidata) {
    try {
      const wikidataImage = await withRequestSlot(() => requestWikidataImage(place.wikidata!));
      if (wikidataImage) return wikidataImage;
    } catch {
      // Continuamos con Wikipedia y luego con el fallback visual de categoría.
    }
  }
  const wiki = place.wikipedia?.match(/^([a-z-]+):(.+)$/i);
  const attempts: { language: string; title?: string }[] = wiki
    ? [{ language: wiki[1], title: wiki[2] }, { language: 'es' }, { language: 'en' }]
    : [{ language: 'es' }, { language: 'en' }];

  for (const attempt of attempts) {
    try {
      const uri = await withRequestSlot(() => requestWikipedia(place, attempt.language, attempt.title));
      if (uri) return uri;
    } catch {
      // The destination photo still covers network failures and articles without images.
    }
  }
  return null;
}

export async function resolvePlaceImage(place: Place): Promise<string | null> {
  if (place.imageUrl) return place.imageUrl;
  const memoryHit = memory.get(place.id);
  if (memoryHit) return memoryHit;
  const running = pending.get(place.id);
  if (running) return running;

  const operation = (async () => {
    const stored = await AsyncStorage.getItem(`${CACHE_PREFIX}${place.id}`).catch(() => null);
    if (stored) {
      memory.set(place.id, stored);
      return stored;
    }
    const resolved = await resolveUncached(place);
    if (resolved) {
      memory.set(place.id, resolved);
      void AsyncStorage.setItem(`${CACHE_PREFIX}${place.id}`, resolved);
    }
    return resolved;
  })().finally(() => pending.delete(place.id));

  pending.set(place.id, operation);
  return operation;
}
