import { BUDGETS, PACES } from '@/data/catalog';
import { placesByCity } from '@/data/places';
import { addDays, daysInclusive, weekday } from '@/lib/dates';
import { centroid, distanceM, legBetween, placePt } from '@/lib/geo';
import type { Activity, Day, Draft, Place } from '@/types';

const START_MIN = 9 * 60 + 30; // arranca 09:30
const LUNCH_FROM = 12 * 60 + 30;
const DINNER_MIN = 20 * 60;

let counter = 0;
const uid = () => `a${Date.now().toString(36)}${(counter++).toString(36)}`;

type Weighted = { place: Place; score: number };

/** Genera el itinerario completo a partir del borrador. */
export function generateItinerary(draft: Draft): Day[] {
  if (!draft.cityId || !draft.startDate || !draft.endDate) return [];

  const numDays = daysInclusive(draft.startDate, draft.endDate);
  const budgetMax = BUDGETS.find((b) => b.id === draft.budget)?.maxTier ?? 3;
  const pace = PACES.find((p) => p.id === draft.pace) ?? PACES[1];
  const perDay = pace.perDay;
  const hasDinner = draft.pace !== 'tranquilo';

  const all = placesByCity(draft.cityId).filter((p) => !draft.removedIds?.includes?.(p.id));
  const sights = all.filter((p) => !p.isMeal);
  const meals = all.filter((p) => p.isMeal);

  const score = (p: Place): number => {
    let s = p.rating * 10;
    const matches = p.categories.filter((c) => draft.interests.includes(c)).length;
    s += matches * 12;
    if (p.categories.includes('iconico')) s += 8;
    if (draft.mustSeeIds.includes(p.id)) s += 1000;
    if (p.price > budgetMax) s -= 25;
    return s;
  };

  const ranked: Weighted[] = sights.map((p) => ({ place: p, score: score(p) })).sort((a, b) => b.score - a.score);

  // Selección de lugares (imprescindibles primero, luego por puntaje)
  const need = perDay * numDays;
  const chosen: Place[] = [];
  const seen = new Set<string>();
  for (const p of sights.filter((p) => draft.mustSeeIds.includes(p.id))) {
    chosen.push(p);
    seen.add(p.id);
  }
  for (const { place } of ranked) {
    if (chosen.length >= need) break;
    if (!seen.has(place.id)) {
      chosen.push(place);
      seen.add(place.id);
    }
  }

  // Agrupar por cercanía en días
  const remaining = [...chosen];
  const groups: Place[][] = [];
  for (let d = 0; d < numDays; d++) {
    const group: Place[] = [];
    if (remaining.length) {
      group.push(remaining.shift()!); // semilla = mayor prioridad restante
      while (group.length < perDay && remaining.length) {
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
    groups.push(group);
  }

  const usedMeals = new Set<string>();
  const pickMeal = (near: Place): Place | null => {
    const pool = meals
      .filter((m) => !usedMeals.has(m.id))
      .map((m) => ({ m, d: distanceM(m, near), ok: m.price <= budgetMax }))
      .sort((a, b) => Number(b.ok) - Number(a.ok) || a.d - b.d);
    const choice = pool[0]?.m ?? meals.find((m) => !usedMeals.has(m.id)) ?? null;
    if (choice) usedMeals.add(choice.id);
    return choice;
  };

  const start = draft.startDate;
  const acc = draft.accommodation;

  return groups.map((group, dayIdx) => {
    const date = addDays(start, dayIdx);
    if (!group.length) return { date, zone: '', activities: [] };

    // Ordenar ruta (vecino más cercano desde el alojamiento o el más prioritario)
    const pool = [...group];
    const ordered: Place[] = [];
    let ref = acc ? { lat: acc.lat, lng: acc.lng } : placePt(pool[0]);
    if (!acc) ordered.push(pool.shift()!);
    while (pool.length) {
      let bi = 0;
      let bd = Infinity;
      pool.forEach((p, i) => {
        const dd = distanceM(ref, p);
        if (dd < bd) {
          bd = dd;
          bi = i;
        }
      });
      const nx = pool.splice(bi, 1)[0];
      ordered.push(nx);
      ref = placePt(nx);
    }

    // Armar secuencia de paradas con comidas intercaladas
    type Stop = { place: Place; dinner?: boolean };
    const stops: Stop[] = [];
    let simT = START_MIN;
    let lunchDone = false;
    for (let i = 0; i < ordered.length; i++) {
      const p = ordered[i];
      if (!lunchDone && simT >= LUNCH_FROM) {
        const meal = pickMeal(p);
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
    if (!lunchDone && ordered.length >= 2) {
      const at = Math.min(1, ordered.length - 1);
      const meal = pickMeal(ordered[at]);
      if (meal) stops.splice(at + 1, 0, { place: meal });
    }
    if (hasDinner) {
      const meal = pickMeal(ordered[ordered.length - 1]);
      if (meal) stops.push({ place: meal, dinner: true });
    }

    // Agendar horarios
    let t = START_MIN;
    const activities: Activity[] = [];
    const wd = weekday(date);
    for (let i = 0; i < stops.length; i++) {
      const { place: p, dinner } = stops[i];
      if (dinner && t < DINNER_MIN) t = DINNER_MIN;
      const closed = p.opensDay ? !p.opensDay.includes(wd) : false;
      activities.push({
        id: uid(),
        placeId: p.id,
        startMin: t,
        durationMin: p.durationMin,
        status: 'plan',
        mustSee: draft.mustSeeIds.includes(p.id),
        note: closed ? 'Podría estar cerrado este día — verificá los horarios.' : undefined,
      });
      t += p.durationMin;
      if (i < stops.length - 1) t += legBetween(p, stops[i + 1].place).minutes;
    }

    // Zona principal del día (la más frecuente entre no-comidas)
    const zones: Record<string, number> = {};
    group.forEach((p) => (zones[p.zone] = (zones[p.zone] ?? 0) + 1));
    const zone = Object.entries(zones).sort((a, b) => b[1] - a[1])[0]?.[0] ?? group[0].zone;

    return { date, zone, activities };
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
