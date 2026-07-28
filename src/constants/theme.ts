/**
 * Sistema de tema de la app (paleta de marca).
 * Modo claro como principal; el oscuro es una variante cálida de respaldo.
 *
 * Los componentes ThemedText/ThemedView usan las claves:
 *   text, textSecondary, background, backgroundElement, backgroundSelected
 * El resto son tokens de marca que agregamos (primary=coral, secondary=turquesa, etc.).
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Texto
    text: '#1D2733', // azul grisáceo oscuro
    textSecondary: '#667085', // gris
    textOnPrimary: '#FFFFFF',
    textOnSecondary: '#FFFFFF',

    // Fondos y superficies
    background: '#FAF8F4', // blanco cálido
    surface: '#FFFFFF',
    backgroundElement: '#FFFFFF', // tarjetas
    backgroundSelected: '#FFEDE7', // coral muy suave (estado seleccionado)

    // Marca
    primary: '#FF6B4A', // coral energético (acciones principales)
    primaryStrong: '#F2542D',
    primarySoft: '#FFEDE7', // fondo coral suave
    secondary: '#16A085', // verde turquesa (rutas, mapas, positivo)
    secondarySoft: '#E4F5F0',

    // Bordes y estados
    border: '#E6E8EC',
    warning: '#F59E0B',
    error: '#D92D20',
    success: '#16A085',

    // Navegación
    tabInactive: '#98A2B3',
  },
  dark: {
    text: '#F5F3EF',
    textSecondary: '#A6ADBB',
    textOnPrimary: '#FFFFFF',
    textOnSecondary: '#FFFFFF',

    background: '#15181C',
    surface: '#1E2228',
    backgroundElement: '#1E2228',
    backgroundSelected: '#3A2620',

    primary: '#FF6B4A',
    primaryStrong: '#F2542D',
    primarySoft: '#3A2620',
    secondary: '#1FB89A',
    secondarySoft: '#16302B',

    border: '#2A2F37',
    warning: '#F59E0B',
    error: '#F0685F',
    success: '#1FB89A',

    tabInactive: '#667085',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Radios de esquina (bordes suaves, según la dirección visual). */
export const Radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
