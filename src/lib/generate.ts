import { BUDGETS, PACES } from '@/data/catalog';
import { placeById, placesByCity } from '@/data/places';
import { addDays, daysInclusive, weekday } from '@/lib/dates';
import { centroid, distanceM, legBetween, placePt } from '@/lib/geo';
import { DEFAULT_DAY_START, optimizeRoute, scheduleActivities } from '@/lib/schedule';
import type { Activity, Day, Draft, Place, TripDestination } from '@/types';

const LUNCH_FROM = 12 * 60 + 30;
const DINNER_MIN = 20 * 60;
const DEFAULT_DAY_END = 22 * 60 + 30;
const PACE_CADENCE_MIN = { tranquilo: 135, equilibrado: 105, intenso: 85 } as const;

let counter = 0;
const uid = () => `a${Date.now().toString(36)}${(counter++).toString(36)}`;

type Weighted = { place: Place; score: number };

const INTENT_CATEGORY_TERMS: Partial<Record<Place['categories'][number], string[]>> = {
  gastronomia: ['comer', 'comida', 'restaurante', 'cafe', 'pizza', 'mercado', 'gastronomia'],
  historia: ['historia', 'historico', 'monumento', 'antiguo'],
  museos: ['museo', 'exposicion', 'galeria'],
  arquitectura: ['arquitectura', 'edificio', 'iglesia', 'catedral'],
  arte: ['arte', 'pintura', 'escultura'],
  parques: ['parque', 'jardin', 'verde'],
  naturaleza: ['naturaleza', 'playa', 'rio', 'sendero'],
  compras: ['compras', 'shopping', 'tiendas', 'mercado'],
  vidanocturna: ['noche', 'bar', 'boliche', 'club'],
  fotografia: ['foto', 'fotografia', 'mirador', 'vista'],
  iconico: ['famoso', 'imperdible', 'clasico', 'iconico'],
  local: ['local', 'barrio', 'autentico'],
  gratis: ['gratis', 'gratuito', 'economico'],
  musica: ['musica', 'concierto', 'teatro'],
  deportes: ['deporte', 'estadio', 'partido', 'bicicleta'],
};

function normalized(value = '') {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
}

function intentAffinity(place: Place, intent?: string) {
  const query = normalized(intent).trim();
  if (!query) return 0;
  const searchable = normalized([place.name, place.zone, place.desc, place.reason, ...place.categories].filter(Boolean).join(' '));
  let affinity = 0;
  const meaningfulWords = query.split(/\s+/).filter((word) => word.length >= 4);
  affinity += meaningfulWords.filter((word) => searchable.includes(word)).length * 6;
  const normalizedName = normalized(place.name);
  const rejectsName = [`evitar ${normalizedName}`, `sin ${normalizedName}`, `no quiero ${normalizedName}`].some((phrase) => query.includes(phrase));
  if (rejectsName) affinity -= 120;
  else if (query.includes(normalizedName)) affinity += 90;
  place.categories.forEach((category) => {
    const terms = INTENT_CATEGORY_TERMS[category] ?? [];
    const rejected = terms.some((term) => [`evitar ${term}`, `sin ${term}`, `no quiero ${term}`, `no me interesa ${term}`].some((phrase) => query.includes(phrase)));
    if (rejected) affinity -= 45;
    else if (terms.some((term) => query.includes(term))) affinity += 15;
  });
  return Math.max(-140, Math.min(120, affinity));
}

function popularityOf(place: Place) {
  if (place.popularityScore != null) return place.popularityScore;
  if (place.categories.includes('iconico')) return place.source === 'openstreetmap' ? 76 : 96;
  if (!place.source || place.source === 'curated') return 82;
  if (place.kind === 'event') return 74;
  return 48;
}

/** Genera el itinerario completo a partir del borrador. */
function generateSingleCityItinerary(draft: Draft): Day[] {
  if (!draft.cityId || !draft.startDate || !draft.endDate) return [];

  const numDays = daysInclusive(draft.startDate, draft.endDate);
  const budgetMax = BUDGETS.find((b) => b.id === draft.budget)?.maxTier ?? 3;
  const pace = PACES.find((p) => p.id === draft.pace) ?? PACES[1];
  const perDay = pace.perDay;
  const wantsGastronomy = draft.interests.includes('gastronomia');
  const generalStart = draft.dayStartMin ?? DEFAULT_DAY_START;

  const dayStartFor = (index: number) => {
    let start = generalStart;
    if (index === 0 && draft.arrivalTime != null) {
      const readyAfterArrival =
        draft.arrivalTime +
        (draft.arrivalBufferMin ?? 75) +
        (draft.arrivalTransferMin ?? 45) +
        (draft.canLeaveLuggage ? 20 : 60);
      start = Math.max(start, readyAfterArrival, draft.canLeaveLuggage ? 0 : draft.checkInTime ?? 0);
    }
    return Math.ceil(start / 15) * 15;
  };
  const dayEndFor = (index: number) => {
    if (index !== numDays - 1 || draft.departureTime == null) return DEFAULT_DAY_END;
    const end = draft.departureTime - (draft.departureLeadMin ?? 120) - (draft.departureTransferMin ?? 45);
    return Math.floor(end / 15) * 15;
  };
  const capacities = Array.from({ length: numDays }, (_, index) => {
    const available = Math.max(0, dayEndFor(index) - dayStartFor(index));
    if (available < 90) return 0;
    const crossesLunch = dayStartFor(index) <= LUNCH_FROM && dayEndFor(index) >= LUNCH_FROM + 60;
    const mealReserve = crossesLunch ? 75 : 0;
    const cadence = PACE_CADENCE_MIN[draft.pace];
    return Math.min(perDay, Math.max(1, Math.floor((available - mealReserve) / cadence)));
  });

  const removedIds = 'removedIds' in draft && Array.isArray(draft.removedIds) ? draft.removedIds : [];
  const all = placesByCity(draft.cityId).filter(
    (p) =>
      !removedIds.includes(p.id) &&
      (!p.eventDate || (p.eventDate >= draft.startDate! && p.eventDate <= draft.endDate!)) &&
      p.availability !== 'offsale',
  );
  const sights = all.filter((p) => !p.isMeal);
  const meals = all.filter((p) => p.isMeal);

  const score = (p: Place): number => {
    let s = p.rating * 7 + popularityOf(p) * 0.82;
    const matches = p.categories.filter((c) => draft.interests.includes(c)).length;
    s += matches ? 42 + (matches - 1) * 20 : 0;
    if (p.categories.includes('iconico')) s += 30;
    if (p.kind === 'event') s += draft.interests.some((interest) => p.categories.includes(interest)) ? 18 : 5;
    s += intentAffinity(p, draft.travelIntentText);
    if (draft.mustSeeIds.includes(p.id)) s += 1000;
    if (p.price > budgetMax) s -= draft.budget === 'economico' ? 50 : 30;
    const groupSignals = {
      solo: ['local', 'fotografia', 'museos'],
      pareja: ['gastronomia', 'arte', 'arquitectura'],
      amigos: ['vidanocturna', 'musica', 'gastronomia'],
      familia: ['parques', 'naturaleza', 'iconico'],
      trabajo: ['gastronomia', 'arquitectura', 'local'],
      otro: [],
    } as const;
    const signals = draft.groupType ? groupSignals[draft.groupType] : [];
    if (p.categories.some((category) => (signals as readonly string[]).includes(category))) s += 9;
    if (draft.groupType === 'familia' && p.categories.includes('vidanocturna')) s -= 18;
    if ((draft.partySize ?? 1) >= 5 && p.kind === 'event') s -= 4; // disponibilidad grupal suele ser más difícil
    return s;
  };

  const ranked: Weighted[] = sights.map((p) => ({ place: p, score: score(p) })).sort((a, b) => b.score - a.score);

  // Selección editorial: imprescindibles, intereses repartidos, clásicos y variedad.
  const need = capacities.reduce((total, capacity) => total + capacity, 0);
  const chosen: Place[] = [];
  const seen = new Set<string>();
  const addChoice = (place: Place) => {
    if (seen.has(place.id) || chosen.length >= need) return false;
    chosen.push(place);
    seen.add(place.id);
    return true;
  };
  for (const p of sights.filter((p) => draft.mustSeeIds.includes(p.id))) {
    addChoice(p);
  }

  const personalizedTarget = Math.min(
    Math.max(0, need - chosen.length),
    Math.max(draft.interests.length, Math.round(need * 0.65)),
  );
  let personalizedAdded = 0;
  let foundPersonalized = true;
  while (personalizedAdded < personalizedTarget && foundPersonalized) {
    foundPersonalized = false;
    for (const interest of draft.interests) {
      if (personalizedAdded >= personalizedTarget) break;
      const candidate = ranked.find(({ place }) => !seen.has(place.id) && place.categories.includes(interest));
      if (candidate && addChoice(candidate.place)) {
        personalizedAdded++;
        foundPersonalized = true;
      }
    }
  }

  const essentialTarget = Math.min(need, Math.max(1, Math.ceil(need * 0.3)));
  let essentials = chosen.filter(
    (place) => place.categories.includes('iconico') || popularityOf(place) >= 82,
  ).length;
  for (const { place } of ranked) {
    if (chosen.length >= need || essentials >= essentialTarget) break;
    if (
      (place.categories.includes('iconico') || popularityOf(place) >= 82) &&
      addChoice(place)
    ) essentials++;
  }
  for (const { place } of ranked) {
    if (chosen.length >= need) break;
    addChoice(place);
  }

  // Agrupar por cercanía en días. Los eventos quedan fijados a su fecha real.
  const remaining = [...chosen].sort((a, b) => score(b) - score(a));
  const groups: Place[][] = Array.from({ length: numDays }, () => []);
  for (let index = remaining.length - 1; index >= 0; index--) {
    const event = remaining[index];
    if (!event.eventDate) continue;
    const dayIndex = Array.from({ length: numDays }, (_, i) => addDays(draft.startDate!, i)).indexOf(event.eventDate);
    if (dayIndex >= 0 && groups[dayIndex].length < capacities[dayIndex]) {
      groups[dayIndex].push(event);
      remaining.splice(index, 1);
    }
  }
  for (let d = 0; d < numDays; d++) {
    const group = groups[d];
    if (remaining.length) {
      if (!group.length && capacities[d] > 0) group.push(remaining.shift()!); // semilla = mayor prioridad restante
      while (group.length < capacities[d] && remaining.length) {
        const c = centroid(group.map(placePt));
        let bi = 0;
        let bd = Infinity;
        remaining.forEach((p, i) => {
          const dd = distanceM(c, p);
          if (dd < bd) {
            bd = dd;
            bi = i;
          }
        });
        group.push(remaining.splice(bi, 1)[0]);
      }
    }
  }

  const usedMeals = new Set<string>();
  const pickMeal = (near: Place, moment: 'lunch' | 'dinner'): Place | null => {
    const pool = meals
      .filter((m) => !usedMeals.has(m.id))
      .map((m) => {
        const distance = distanceM(m, near);
        const cafePenalty = moment === 'lunch' && /cafe|coffee|bakery|pasteler|helad/.test(normalized(`${m.name} ${m.desc}`)) ? 16 : 0;
        const quality = m.rating * 13 + popularityOf(m) * 0.4;
        const budgetFit = m.price <= budgetMax ? 24 : draft.budget === 'economico' ? -45 : -18;
        const localBonus = m.categories.includes('local') ? 7 : 0;
        return { m, value: quality + budgetFit + localBonus - Math.min(35, distance / 120) - cafePenalty };
      })
      .sort((a, b) => b.value - a.value);
    const choice = pool[0]?.m ?? null;
    if (choice) usedMeals.add(choice.id);
    return choice;
  };

  const start = draft.startDate;
  const acc = draft.accommodation;
  return groups.map((group, dayIdx) => {
    const date = addDays(start, dayIdx);
    const dayStart = dayStartFor(dayIdx);
    const dayEnd = dayEndFor(dayIdx);
    if (!group.length) return {
      date,
      cityId: draft.cityId,
      cityName: draft.cityName,
      country: draft.country,
      zone: '',
      startMin: dayStart,
      activities: [],
    };

    // 1) Ruta óptima: arranca en el alojamiento y evita cruzar la ciudad (2-opt)
    const routePlaces = group.filter((place) => place.kind !== 'event');
    const fixedEvents = group
      .filter((place) => place.kind === 'event')
      .sort((a, b) => (a.eventStartMin ?? DEFAULT_DAY_END) - (b.eventStartMin ?? DEFAULT_DAY_END));
    const ordered = [
      ...optimizeRoute(routePlaces, acc ? { lat: acc.lat, lng: acc.lng } : null),
      ...fixedEvents,
    ];

    // 2) Intercalar comidas (almuerzo al cruzar el mediodía; cena al final)
    type Stop = { place: Place; dinner?: boolean };
    const stops: Stop[] = [];
    let simT = dayStart;
    let lunchDone = false;
    const crossesLunch = dayStart <= LUNCH_FROM && dayEnd >= LUNCH_FROM + 60;
    const hasDinner =
      dayEnd >= DINNER_MIN + 60 &&
      ((wantsGastronomy && draft.pace !== 'tranquilo') ||
        (draft.pace === 'intenso' && draft.interests.includes('vidanocturna')));
    for (let i = 0; i < ordered.length; i++) {
      const p = ordered[i];
      if (crossesLunch && !lunchDone && simT >= LUNCH_FROM) {
        const meal = pickMeal(p, 'lunch');
        if (meal) {
          stops.push({ place: meal });
          simT += meal.durationMin + 12;
        }
        lunchDone = true;
      }
      stops.push({ place: p });
      simT += p.durationMin;
      if (i < ordered.length - 1) simT += legBetween(p, ordered[i + 1]).minutes;
    }
    if (crossesLunch && !lunchDone && ordered.length >= 2) {
      const at = Math.min(1, ordered.length - 1);
      const meal = pickMeal(ordered[at], 'lunch');
      if (meal) stops.splice(at + 1, 0, { place: meal });
    }
    if (hasDinner) {
      const meal = pickMeal(ordered[ordered.length - 1], 'dinner');
      if (meal) stops.push({ place: meal, dinner: true });
    }

    // 3) Agendar con horarios naturales (redondeados a 5') y sin solapes
    const wd = weekday(date);
    const drafts = stops.map(({ place: p }) => ({
      placeId: p.id,
      durationMin: p.durationMin,
      earliestStartMin: Math.max(
        p.eventStartMin ?? 0,
        p.openFrom ? Number(p.openFrom.slice(0, 2)) * 60 + Number(p.openFrom.slice(3, 5)) : 0,
      ) || undefined,
      mustSee: draft.mustSeeIds.includes(p.id),
      note: p.opensDay && !p.opensDay.includes(wd) ? 'Podría estar cerrado este día — verificá los horarios.' : undefined,
    }));
    const timed = scheduleActivities(drafts, dayStart, (i) => (stops[i].dinner ? DINNER_MIN : undefined));
    const activities: Activity[] = timed
      .filter((d) => {
        const place = placeById(d.placeId);
        const closeMin = place?.openTo
          ? Number(place.openTo.slice(0, 2)) * 60 + Number(place.openTo.slice(3, 5))
          : Infinity;
        return ((d.startMin + d.durationMin <= dayEnd && d.startMin + d.durationMin <= closeMin) || d.mustSee);
      })
      .map((d) => ({
      id: uid(),
      placeId: d.placeId,
      startMin: d.startMin,
      durationMin: d.durationMin,
      status: 'plan',
      mustSee: d.mustSee,
      note: d.note,
      }));

    // Zona principal del día (la más frecuente entre los lugares del día)
    const zones: Record<string, number> = {};
    group.forEach((p) => (zones[p.zone] = (zones[p.zone] ?? 0) + 1));
    const zone = Object.entries(zones).sort((a, b) => b[1] - a[1])[0]?.[0] ?? group[0].zone;

    return {
      date,
      cityId: draft.cityId,
      cityName: draft.cityName,
      country: draft.country,
      zone,
      startMin: dayStart,
      activities,
    };
  });
}

function normalizeDestinationDays(destinations: TripDestination[], totalDays: number) {
  const safe = destinations
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((destination) => ({ ...destination, days: Math.max(1, Math.round(destination.days || 1)) }));
  if (!safe.length) return safe;

  let assigned = safe.reduce((sum, destination) => sum + destination.days, 0);
  while (assigned < totalDays) {
    const target = safe.reduce((best, destination) => destination.days < best.days ? destination : best, safe[0]);
    target.days += 1;
    assigned += 1;
  }
  while (assigned > totalDays) {
    const target = safe.reduce((best, destination) => destination.days > best.days ? destination : best, safe[0]);
    if (target.days <= 1) break;
    target.days -= 1;
    assigned -= 1;
  }
  return safe;
}

/** Genera uno o varios tramos de ciudad respetando la ruta elegida por el viajero. */
export function generateItinerary(draft: Draft): Day[] {
  if (!draft.cityId || !draft.startDate || !draft.endDate) return [];
  const totalDays = daysInclusive(draft.startDate, draft.endDate);
  const requested = draft.destinations?.length
    ? draft.destinations
    : [{
        cityId: draft.cityId,
        cityName: draft.cityName ?? '',
        country: draft.country ?? '',
        days: totalDays,
        order: 0,
      }];
  const destinations = normalizeDestinationDays(requested, totalDays);
  if (destinations.length > totalDays) return [];

  let offset = 0;
  return destinations.flatMap((destination, index) => {
    const segmentStart = addDays(draft.startDate!, offset);
    const segmentEnd = addDays(segmentStart, destination.days - 1);
    const segment = generateSingleCityItinerary({
      ...draft,
      cityId: destination.cityId,
      cityName: destination.cityName,
      country: destination.country,
      startDate: segmentStart,
      endDate: segmentEnd,
      accommodation: index === 0 ? draft.accommodation : null,
      mustSeeIds: draft.mustSeeIds.filter((id) => placeById(id)?.cityId === destination.cityId),
      arrivalTime: index === 0 ? draft.arrivalTime : undefined,
      departureTime: index === destinations.length - 1 ? draft.departureTime : undefined,
    });
    offset += destination.days;
    return segment.map((day) => ({
      ...day,
      cityId: destination.cityId,
      cityName: destination.cityName,
      country: destination.country,
    }));
  });
}

/** Estadísticas rápidas de un conjunto de días (para tarjetas de resumen). */
export function tripStats(days: Day[]) {
  let activities = 0;
  const zones = new Set<string>();
  days.forEach((d) => {
    activities += d.activities.length;
    if (d.zone) zones.add(d.zone);
  });
  return { days: days.length, activities, zones: zones.size };
}
