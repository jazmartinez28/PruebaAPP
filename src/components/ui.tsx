/**
 * Componentes base reutilizables de la app.
 * Todo referencia el tema (paleta de marca) para mantener coherencia visual.
 */
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type TextProps,
  type ViewProps,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { TAB_BAR_HEIGHT } from './app-tabs';

type IonName = keyof typeof Ionicons.glyphMap;

/* ---------------------------------------------------------------- Screen -- */

export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  padded = true,
  fullScreen = false,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  padded?: boolean;
  /** true en rutas que NO tienen la barra de tabs (flujo, viaje, etc.) */
  fullScreen?: boolean;
}) {
  const t = useTheme();
  const bottomPad = fullScreen ? Spacing.six : TAB_BAR_HEIGHT + Spacing.six;

  const body = scroll ? (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        { paddingBottom: bottomPad, gap: Spacing.four },
        padded && { paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
        styles.centered,
      ]}>
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, paddingBottom: bottomPad }, padded && styles.pagePad]}>{children}</View>
  );

  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: t.background }}>
      {body}
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------ Typography -- */

export function H1({ style, ...p }: TextProps) {
  const t = useTheme();
  return <Text {...p} style={[styles.h1, { color: t.text }, style]} />;
}
export function H2({ style, ...p }: TextProps) {
  const t = useTheme();
  return <Text {...p} style={[styles.h2, { color: t.text }, style]} />;
}
export function Body({ style, muted, ...p }: TextProps & { muted?: boolean }) {
  const t = useTheme();
  return <Text {...p} style={[styles.body, { color: muted ? t.textSecondary : t.text }, style]} />;
}
export function Label({ style, ...p }: TextProps) {
  const t = useTheme();
  return <Text {...p} style={[styles.label, { color: t.textSecondary }, style]} />;
}

/* ---------------------------------------------------------------- Card --- */

export function Card({ style, children, ...p }: ViewProps) {
  const t = useTheme();
  return (
    <View
      {...p}
      style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }, style]}>
      {children}
    </View>
  );
}

/* -------------------------------------------------------------- Buttons -- */

type BtnProps = PressableProps & {
  title: string;
  icon?: IonName;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'lg';
};

export function Button({
  title,
  icon,
  loading,
  variant = 'primary',
  size = 'lg',
  disabled,
  style,
  ...p
}: BtnProps) {
  const t = useTheme();
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';

  const bg = isPrimary ? t.primary : isSecondary ? t.secondary : 'transparent';
  const fg = variant === 'ghost' ? t.primary : t.textOnPrimary;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        size === 'lg' ? styles.btnLg : styles.btnMd,
        { backgroundColor: bg },
        variant === 'ghost' && { borderWidth: 1.5, borderColor: t.border },
        (pressed || disabled) && { opacity: disabled ? 0.5 : 0.85 },
        style as object,
      ]}
      {...p}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={20} color={fg} />}
          <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

/* --------------------------------------------------------------- Chip ---- */

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IonName;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? t.primarySoft : t.surface,
          borderColor: selected ? t.primary : t.border,
        },
        pressed && { opacity: 0.8 },
      ]}>
      {icon && <Ionicons name={icon} size={16} color={selected ? t.primary : t.textSecondary} />}
      <Text style={[styles.chipText, { color: selected ? t.primaryStrong : t.text }]}>{label}</Text>
    </Pressable>
  );
}

/* --------------------------------------------------------------- Styles -- */

const styles = StyleSheet.create({
  centered: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  pagePad: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  h1: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.5 },
  h2: { fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.three,
    boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 6px 16px rgba(16,24,40,0.05)',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: Radius.pill,
  },
  btnLg: { paddingVertical: 16, paddingHorizontal: Spacing.four },
  btnMd: { paddingVertical: 11, paddingHorizontal: Spacing.three },
  btnText: { fontSize: 16, fontWeight: '700' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  chipText: { fontSize: 14, fontWeight: '600' },
});
