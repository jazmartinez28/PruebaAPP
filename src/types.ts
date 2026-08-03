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
export type GroupType = 'solo' | 'pareja' | 'amigos' | 'familia' | 'trabajo' | 'otro';
export type AccommodationChoice = 'yes' | 'no' | 'later';
export type TravelPointType = 'aeropuerto' | 'estacion' | 'terminal' | 'puerto' | 'direccion' | 'otro';
export type TicketRequirement =
  | 'none'
  | 'free'
  | 'optional'
  | 'recommended'
  | 'required'
  | 'reservation'
  | 'unconfirmed';
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
  popularityScore?: number; // 0-100, relevancia turística/proveedor
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
  imageUrl?: string;
  kind?: 'place' | 'event';
  eventDate?: string;
  eventStartMin?: number;
  eventEndMin?: number;
  availability?: 'onsale' | 'limited' | 'offsale' | 'unknown';
  ticketRequirement?: TicketRequirement;
  source?: 'curated' | 'openstreetmap' | 'ticketmaster' | 'foursquare';
  sourceUrl?: string;
};

export type ActivityStatus = 'plan' | 'reservado' | 'hecho' | 'saltado';
export type PackingCategory = 'ropa' | 'documentacion' | 'higiene' | 'tecnologia' | 'medicamentos' | 'otros';
export type PackingItem = {
  id: string;
  label: string;
  category: PackingCategory;
  packed: boolean;
  suggested?: boolean;
};

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
  startMin?: number; // hora de inicio del día (minutos desde 00:00)
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
  kind?: 'ticket' | 'reservation';
  note?: string;
  attachmentUri?: string;
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
  travelIntentText?: string; // preferencias libres escritas o transcriptas
  travelIntentAudioUri?: string; // referencia local a la nota de voz
  savedIds: string[]; // guardados
  removedIds: string[]; // descartados
  dayStartMin?: number; // hora habitual de comienzo del día
  partySize?: number; // cantidad de personas
  groupType?: GroupType;
  arrivalTime?: number; // hora de llegada al destino (min, día 1)
  departureTime?: number; // hora de salida del destino (min, último día)
  arrivalPlace?: string; // aeropuerto/estación/etc.
  departurePlace?: string;
  arrivalType?: TravelPointType;
  departureType?: TravelPointType;
  arrivalBufferMin?: number;
  arrivalTransferMin?: number;
  departureLeadMin?: number;
  departureTransferMin?: number;
  checkInTime?: number;
  checkOutTime?: number;
  canLeaveLuggage?: boolean;
  tickets: Ticket[];
  packingItems: PackingItem[];
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
  accommodationChoice?: AccommodationChoice;
  interests: Category[];
  pace: Pace;
  budget: Budget;
  mustSeeIds: string[];
  travelIntentText?: string;
  travelIntentAudioUri?: string;
  dayStartMin?: number;
  partySize?: number;
  groupType?: GroupType;
  arrivalTime?: number;
  departureTime?: number;
  arrivalPlace?: string;
  departurePlace?: string;
  arrivalType?: TravelPointType;
  departureType?: TravelPointType;
  arrivalBufferMin?: number;
  arrivalTransferMin?: number;
  departureLeadMin?: number;
  departureTransferMin?: number;
  checkInTime?: number;
  checkOutTime?: number;
  canLeaveLuggage?: boolean;
};

export type User = {
  id: string;
  email: string;
  name: string;
  plan: 'gratis' | 'premium';
  photoUri?: string;
};

export type NotificationPreferences = {
  enabled: boolean;
  tripReminders: boolean;
  weekBefore: boolean;
  dayBefore: boolean;
  tripStart: boolean;
  dailySummary: boolean;
  firstActivity: boolean;
  upcomingActivity: boolean;
  activityLeadMin: 15 | 30 | 60;
  tickets: boolean;
};

export type AppPreferences = {
  language: 'es' | 'en' | 'pt';
  currency: 'auto' | 'EUR' | 'USD' | 'ARS' | 'JPY';
  travelStyle: Pace;
  notifications: NotificationPreferences;
};
