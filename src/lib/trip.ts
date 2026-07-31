import { placeById, placesByCity } from '@/data/places';
import { daysUntil } from '@/lib/dates';
import { distanceM } from '@/lib/geo';
import { DEFAULT_DAY_START, scheduleActivities } from '@/lib/schedule';
import type { Activity, Category, Day, Trip, TripStatus } from '@/types';

/** Recalcula los horarios de un día a partir del orden actual de actividades. */
export function rescheduleDay(day: Day): Day {
  const activities = scheduleActivities(day.activities, day.startMin ?? DEFAULT_DAY_START);
  return { ...day, activities };
}

/** Estado del viaje según las fechas (se calcula, no se guarda). */
export function tripStatusOf(trip: Trip): TripStatus {
  const toStart = daysUntil(trip.startDate);
  const toEnd = daysUntil(trip.endDate);
  if (toEnd < 0) return 'finalizado';
  if (toStart <= 0 && toEnd >= 0) return 'encurso';
  return 'proximo';
}

export type AltFilter = 'cercano' | 'gratis' | 'cultural' | 'gastronomia' | 'tranquilo' | 'todos';

/** Alternativas para reemplazar una actividad. */
export function getAlternatives(trip: Trip, activity: Activity, filter: AltFilter, limit: number) {
  const current = placeById(activity.placeId);
  if (!current) return [];
  const usedIds = new Set(trip.days.flatMap((d) => d.activities.map((a) => a.placeId)));

  let pool = placesByCity(trip.cityId).filter(
    (p) => p.id !== current.id && !usedIds.has(p.id) && !trip.removedIds.includes(p.id) && p.isMeal === current.isMeal,
  );

  if (filter === 'gratis') pool = pool.filter((p) => p.price === 0);
  if (filter === 'gastronomia') pool = pool.filter((p) => p.categories.includes('gastronomia'));
  if (filter === 'cultural')
    pool = pool.filter((p) => p.categories.some((c) => (['museos', 'arte', 'historia'] as Category[]).includes(c)));
  if (filter === 'tranquilo') pool = pool.filter((p) => p.durationMin <= 60);

  return pool
    .map((p) => ({ place: p, dist: distanceM(p, current) }))
    .sort((a, b) => (filter === 'cercano' ? a.dist - b.dist : b.place.rating - a.place.rating || a.dist - b.dist))
    .slice(0, limit);
}
