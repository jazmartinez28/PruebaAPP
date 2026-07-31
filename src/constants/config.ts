/**
 * Configuración general de la app.
 *
 * NOMBRE TEMPORAL: el nombre de marca todavía NO está definido.
 * Cambiá APP_NAME acá cuando se apruebe el definitivo; no hardcodear en pantallas.
 */
export const APP_NAME = 'Rumbo';
export const APP_TAGLINE = 'Tu viaje, organizado en minutos';

/**
 * "Config remota" del modelo freemium. En producción vendría del backend
 * (Supabase / config remota) para poder cambiar límites y precios sin actualizar la app.
 */
export const REMOTE_CONFIG = {
  freeTripLimit: null, // sin límite de viajes durante la etapa de crecimiento
  freeAlternatives: 3, // alternativas al reemplazar (gratis)
  premiumAlternatives: 12,
  premiumMonthly: 'US$5 / mes',
  premiumPerTrip: 'US$8 / viaje',
  budgetByCurrency: {
    EUR: {
      economico: [45, 75],
      moderado: [80, 140],
      comodo: [150, 240],
      premium: [260, 500],
    },
    USD: {
      economico: [55, 90],
      moderado: [100, 170],
      comodo: [180, 290],
      premium: [320, 600],
    },
    ARS: {
      economico: [45000, 85000],
      moderado: [90000, 160000],
      comodo: [175000, 290000],
      premium: [320000, 650000],
    },
    JPY: {
      economico: [7000, 12000],
      moderado: [13000, 23000],
      comodo: [25000, 40000],
      premium: [45000, 85000],
    },
  },
};

export const CITY_CURRENCY: Record<string, keyof typeof REMOTE_CONFIG.budgetByCurrency> = {
  roma: 'EUR',
  paris: 'EUR',
  barcelona: 'EUR',
  buenosaires: 'ARS',
  nuevayork: 'USD',
  tokio: 'JPY',
};
