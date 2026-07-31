import { BUDGETS, PACES } from '@/data/catalog';
import { placesByCity } from '@/data/places';
import { addDays, daysInclusive, weekday } from '@/lib/dates';
import { centroid, distanceM, legBetween, placePt } from '@/lib/geo';
import { DEFAULT_DAY_START, optimizeRoute, scheduleActivities } from '@/lib/schedule';
import type { Activity, Day, Draft, Place } from '@/types';

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

  const removedIds = 'removedIds' in draft && Array.isArray(draft.removedIds) ? draft.removedIds : [];
  const all = placesByCity(draft.cityId).filter((p) => !removedIds.includes(p.id));
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
  const dayStart = draft.dayStartMin ?? DEFAULT_DAY_START;

  return groups.map((group, dayIdx) => {
    const date = addDays(start, dayIdx);
    if (!group.length) return { date, zone: '', startMin: dayStart, activities: [] };

    // 1) Ruta óptima: arranca en el alojamiento y evita cruzar la ciudad (2-opt)
    const ordered = optimizeRoute(group, acc ? { lat: acc.lat, lng: acc.lng } : null);

    // 2) Intercalar comidas (almuerzo al cruzar el mediodía; cena al final)
    type Stop = { place: Place; dinner?: boolean };
    const stops: Stop[] = [];
    let simT = dayStart;
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

    // 3) Agendar con horarios naturales (redondeados a 5') y sin solapes
    const wd = weekday(date);
    const drafts = stops.map(({ place: p }) => ({
      placeId: p.id,
      durationMin: p.durationMin,
      mustSee: draft.mustSeeIds.includes(p.id),
      note: p.opensDay && !p.opensDay.includes(wd) ? 'Podría estar cerrado este día — verificá los horarios.' : undefined,
    }));
    const timed = scheduleActivities(drafts, dayStart, (i) => (stops[i].dinner ? DINNER_MIN : undefined));
    const activities: Activity[] = timed.map((d) => ({
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

    return { date, zone, startMin: dayStart, activities };
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
