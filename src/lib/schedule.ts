import { placeById } from '@/data/places';
import { distanceM, legBetween, placePt } from '@/lib/geo';
import type { Place } from '@/types';

/** Redondea a los 5 minutos más cercanos (horarios naturales, sin 20:33). */
export function roundNearest5(min: number): number {
  return Math.round(min / 5) * 5;
}
const ceil5 = (min: number) => Math.ceil(min / 5) * 5;

/** Horario de inicio del día por defecto (09:00). */
export const DEFAULT_DAY_START = 9 * 60;

type Timed = { placeId: string; durationMin: number };

/**
 * Asigna horarios a una lista ordenada de actividades.
 * - Los tiempos de traslado internos son exactos, pero cada horario mostrado se redondea a 5'.
 * - Nunca solapa: cada inicio es >= fin de la actividad anterior.
 * - `minStart(i)` permite forzar un piso (p. ej. la cena no antes de las 20:00).
 */
export function scheduleActivities<T extends Timed>(
  acts: T[],
  startMin: number,
  minStart?: (index: number, act: T) => number | undefined,
): (T & { startMin: number })[] {
  let exact = startMin;
  let prevEnd = -Infinity;
  return acts.map((a, i) => {
    const floor = minStart?.(i, a);
    if (floor != null && exact < floor) exact = floor;
    let display = roundNearest5(exact);
    if (display < prevEnd) display = ceil5(prevEnd);
    if (floor != null && display < floor) display = ceil5(floor);
    prevEnd = display + a.durationMin;
    const next = acts[i + 1];
    const p = placeById(a.placeId);
    const np = next ? placeById(next.placeId) : null;
    const travel = p && np ? legBetween(p, np).minutes : 0;
    exact = display + a.durationMin + travel;
    return { ...a, startMin: display };
  });
}

type Pt = { lat: number; lng: number };

/** Costo total del recorrido (metros). Si hay base, empieza y termina en ella. */
function tourCost(order: Place[], base?: Pt | null): number {
  const pts = order.map(placePt);
  if (!pts.length) return 0;
  let cost = 0;
  let prev: Pt = base ?? pts[0];
  const from = base ? 0 : 1;
  for (let i = from; i < pts.length; i++) {
    cost += distanceM(prev, pts[i]);
    prev = pts[i];
  }
  if (base) cost += distanceM(prev, base); // regreso al alojamiento
  return cost;
}

/**
 * Ordena los lugares de un día para minimizar traslados:
 * vecino más cercano desde la base + mejora 2-opt.
 * Con alojamiento, favorece terminar cerca de él (recorrido cerrado).
 */
export function optimizeRoute(places: Place[], base?: Pt | null): Place[] {
  if (places.length <= 2) return [...places];

  // 1) Ruta inicial por vecino más cercano
  const remaining = [...places];
  const order: Place[] = [];
  let ref: Pt = base ?? placePt(remaining[0]);
  if (!base) order.push(remaining.shift()!);
  while (remaining.length) {
    let bi = 0;
    let bd = Infinity;
    remaining.forEach((p, i) => {
      const d = distanceM(ref, p);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    });
    const nx = remaining.splice(bi, 1)[0];
    order.push(nx);
    ref = placePt(nx);
  }

  // 2) Mejora 2-opt (invierte segmentos mientras reduzca el costo total)
  let best = order;
  let bestCost = tourCost(best, base);
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 40) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const candidate = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)];
        const cost = tourCost(candidate, base);
        if (cost + 1 < bestCost) {
          best = candidate;
          bestCost = cost;
          improved = true;
        }
      }
    }
  }
  return best;
}
