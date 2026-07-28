import { Ionicons } from '@expo/vector-icons';

import type { Budget, Category, Pace, PriceTier } from '@/types';

type IonName = keyof typeof Ionicons.glyphMap;

export const INTERESTS: { id: Category; label: string; icon: IonName }[] = [
  { id: 'gastronomia', label: 'Gastronomía', icon: 'restaurant' },
  { id: 'historia', label: 'Historia', icon: 'time' },
  { id: 'museos', label: 'Museos', icon: 'business' },
  { id: 'arquitectura', label: 'Arquitectura', icon: 'business-outline' },
  { id: 'arte', label: 'Arte', icon: 'color-palette' },
  { id: 'parques', label: 'Parques', icon: 'leaf' },
  { id: 'naturaleza', label: 'Naturaleza', icon: 'trail-sign' },
  { id: 'compras', label: 'Compras', icon: 'bag-handle' },
  { id: 'vidanocturna', label: 'Vida nocturna', icon: 'wine' },
  { id: 'fotografia', label: 'Fotografía', icon: 'camera' },
  { id: 'iconico', label: 'Lugares icónicos', icon: 'star' },
  { id: 'local', label: 'Experiencias locales', icon: 'people' },
  { id: 'gratis', label: 'Actividades gratis', icon: 'pricetag' },
  { id: 'musica', label: 'Música', icon: 'musical-notes' },
  { id: 'deportes', label: 'Deportes', icon: 'football' },
];

export const CATEGORY_LABEL: Record<Category, string> = INTERESTS.reduce(
  (acc, i) => ({ ...acc, [i.id]: i.label }),
  {} as Record<Category, string>,
);

export const CATEGORY_ICON: Record<Category, IonName> = INTERESTS.reduce(
  (acc, i) => ({ ...acc, [i.id]: i.icon }),
  {} as Record<Category, IonName>,
);

export const PACES: { id: Pace; label: string; desc: string; icon: IonName; perDay: number }[] = [
  { id: 'tranquilo', label: 'Tranquilo', desc: 'Menos actividades y más tiempo libre.', icon: 'cafe', perDay: 3 },
  { id: 'equilibrado', label: 'Equilibrado', desc: 'Recorrido completo sin correr.', icon: 'walk', perDay: 4 },
  { id: 'intenso', label: 'Intenso', desc: 'Más actividades y menos pausas.', icon: 'flash', perDay: 6 },
];

export const BUDGETS: { id: Budget; label: string; desc: string; maxTier: PriceTier }[] = [
  { id: 'economico', label: 'Económico', desc: 'Prioriza lo gratis y barato.', maxTier: 1 },
  { id: 'moderado', label: 'Moderado', desc: 'Un equilibrio de precios.', maxTier: 2 },
  { id: 'comodo', label: 'Cómodo', desc: 'Sin fijarte tanto en el precio.', maxTier: 3 },
  { id: 'premium', label: 'Premium', desc: 'Lo mejor de cada lugar.', maxTier: 3 },
  { id: 'noindica', label: 'Prefiero no indicarlo', desc: 'Mezclamos opciones para todos.', maxTier: 3 },
];

export const PRICE_LABEL = (tier: PriceTier) => (tier === 0 ? 'Gratis' : '$'.repeat(tier));
