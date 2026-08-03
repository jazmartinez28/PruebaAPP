import type { Place } from '@/types';

export type VisualCategory =
  | 'cultura'
  | 'gastronomia'
  | 'naturaleza'
  | 'historia'
  | 'compras'
  | 'nocturna'
  | 'evento'
  | 'traslado'
  | 'alojamiento';

export const CATEGORY_VISUAL: Record<VisualCategory, { label: string; color: string; soft: string; icon: any }> = {
  cultura: { label: 'Cultura', color: '#7C5CE7', soft: '#F0ECFF', icon: 'color-palette-outline' },
  gastronomia: { label: 'Gastronomía', color: '#E05A3F', soft: '#FFF0EB', icon: 'restaurant-outline' },
  naturaleza: { label: 'Naturaleza', color: '#23866B', soft: '#E7F6F0', icon: 'leaf-outline' },
  historia: { label: 'Historia', color: '#B36A19', soft: '#FFF3DF', icon: 'business-outline' },
  compras: { label: 'Compras', color: '#B54179', soft: '#FCEAF3', icon: 'bag-handle-outline' },
  nocturna: { label: 'Vida nocturna', color: '#4254A7', soft: '#EAEDFF', icon: 'moon-outline' },
  evento: { label: 'Evento', color: '#C24164', soft: '#FDEBF1', icon: 'calendar-outline' },
  traslado: { label: 'Traslado', color: '#137A83', soft: '#E4F5F0', icon: 'navigate-outline' },
  alojamiento: { label: 'Alojamiento', color: '#344054', soft: '#EEF0F3', icon: 'bed-outline' },
};

export function visualCategory(place: Place): VisualCategory {
  if (place.kind === 'event') return 'evento';
  if (place.isMeal || place.categories.includes('gastronomia')) return 'gastronomia';
  if (place.categories.some((c) => c === 'parques' || c === 'naturaleza' || c === 'deportes')) return 'naturaleza';
  if (place.categories.includes('compras')) return 'compras';
  if (place.categories.some((c) => c === 'vidanocturna' || c === 'musica')) return 'nocturna';
  if (place.categories.some((c) => c === 'historia' || c === 'arquitectura' || c === 'iconico')) return 'historia';
  return 'cultura';
}

export function categoryVisualFor(place: Place) {
  return CATEGORY_VISUAL[visualCategory(place)];
}
