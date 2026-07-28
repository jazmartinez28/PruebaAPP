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
  freeTripLimit: 2, // viajes guardados en el plan gratis
  freeAlternatives: 3, // alternativas al reemplazar (gratis)
  premiumAlternatives: 12,
  premiumMonthly: 'US$5 / mes',
  premiumPerTrip: 'US$8 / viaje',
};
