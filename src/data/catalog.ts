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
  { id: 'tranquilo', label: 'Tranquilo', desc: 'Hasta 4 visitas, pausas amplias y tiempo para improvisar.', icon: 'cafe', perDay: 4 },
  { id: 'equilibrado', label: 'Equilibrado', desc: 'Hasta 6 visitas bien conectadas, sin correr.', icon: 'walk', perDay: 6 },
  { id: 'intenso', label: 'Intenso', desc: 'Hasta 8 visitas y jornadas largas para aprovechar la ciudad.', icon: 'flash', perDay: 8 },
];

export const BUDGETS: { id: Budget; label: string; desc: string; includes: string; maxTier: PriceTier }[] = [
  { id: 'economico', label: 'Económico', desc: 'Cuidar el gasto sin perderte la ciudad.', includes: 'Actividades gratuitas o económicas y comidas accesibles.', maxTier: 1 },
  { id: 'moderado', label: 'Moderado', desc: 'Equilibrio entre experiencias y precio.', includes: 'Opciones gratuitas y pagas, con restaurantes de precio medio.', maxTier: 2 },
  { id: 'comodo', label: 'Cómodo', desc: 'Más libertad para elegir experiencias.', includes: 'Más actividades pagas y restaurantes mejor valorados.', maxTier: 3 },
  { id: 'premium', label: 'Premium', desc: 'Priorizar calidad y experiencias especiales.', includes: 'Experiencias exclusivas, restaurantes destacados y poca restricción de precio.', maxTier: 3 },
  { id: 'noindica', label: 'Prefiero no indicarlo', desc: 'Mezclamos opciones para todos.', includes: 'No condicionamos el itinerario por precio.', maxTier: 3 },
];

export const PRICE_LABEL = (tier: PriceTier) => (tier === 0 ? 'Gratis' : '$'.repeat(tier));
