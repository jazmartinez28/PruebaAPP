/** Modelo de datos central de la app. */

export type Category =
  | 'gastronomia'
  | 'historia'
  | 'museos'
  | 'arquitectura'
  | 'arte'
  | 'parques'
  | 'naturaleza'
  | 'compras'
  | 'vidanocturna'
  | 'fotografia'
  | 'iconico'
  | 'local'
  | 'gratis'
  | 'musica'
  | 'deportes';

export type Pace = 'tranquilo' | 'equilibrado' | 'intenso';
export type Budget = 'economico' | 'moderado' | 'comodo' | 'premium' | 'noindica';
export type PriceTier = 0 | 1 | 2 | 3; // 0 gratis, 1 $, 2 $$, 3 $$$

/** Lugar (punto de interés, restaurante, actividad). */
export type Place = {
  id: string;
  cityId: string;
  name: string;
  categories: Category[];
  lat: number;
  lng: number;
  zone: string; // barrio / zona
  durationMin: number; // duración estimada de visita
  price: PriceTier;
  rating: number; // 0-5
  desc: string;
  reason?: string; // por qué lo recomendamos
  opensDay?: number[]; // días de la semana que abre (0=Dom..6=Sáb); undefined = siempre
  openFrom?: string; // "09:00"
  openTo?: string; // "18:00"
  needsBooking?: boolean;
  confident?: boolean; // false => mostrar "sujeto a cambios"
  isMeal?: boolean; // true para restaurantes (usados en almuerzo/cena)
  address?: string;
  officialUrl?: string;
  bookingUrl?: string;
  source?: 'curated' | 'openstreetmap';
  sourceUrl?: string;
};

export type ActivityStatus = 'plan' | 'reservado' | 'hecho' | 'saltado';

/** Actividad = un lugar ubicado en un día y horario dentro del itinerario. */
export type Activity = {
  id: string;
  placeId: string;
  startMin: number; // minutos desde 00:00
  durationMin: number;
  status: ActivityStatus;
  mustSee?: boolean;
  note?: string;
};

export type Day = {
  date: string; // ISO yyyy-mm-dd
  zone: string; // zona principal del día
  activities: Activity[];
};

export type TripStatus = 'proximo' | 'encurso' | 'finalizado';

export type Accommodation = {
  name: string;
  address?: string;
  lat: number;
  lng: number;
  zone?: string;
} | null;

export type Ticket = {
  id: string;
  activityId?: string;
  placeId: string;
  title: string;
  provider?: string;
  confirmationCode?: string;
  ticketUrl?: string;
  purchaseUrl?: string;
  date?: string;
  createdAt: number;
};

export type Trip = {
  id: string;
  cityId: string;
  cityName: string;
  country: string;
  startDate: string; // ISO
  endDate: string; // ISO
  accommodation: Accommodation;
  interests: Category[];
  pace: Pace;
  budget: Budget;
  mustSeeIds: string[]; // lugares imprescindibles
  savedIds: string[]; // guardados
  removedIds: string[]; // descartados
  tickets: Ticket[];
  days: Day[];
  createdAt: number;
  updatedAt: number;
};

/** Borrador del flujo "Crear viaje". */
export type Draft = {
  cityId?: string;
  cityName?: string;
  country?: string;
  startDate?: string;
  endDate?: string;
  accommodation: Accommodation;
  interests: Category[];
  pace: Pace;
  budget: Budget;
  mustSeeIds: string[];
};

export type User = {
  id: string;
  email: string;
  name: string;
  plan: 'gratis' | 'premium';
};
