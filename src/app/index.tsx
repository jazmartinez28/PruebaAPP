import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Card, H1, H2, Label, Screen } from '@/components/ui';
import { APP_NAME } from '@/constants/config';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const STEPS = [
  { icon: 'options-outline', title: 'Contanos tu viaje', desc: 'Destino, fechas e intereses. En un minuto.' },
  { icon: 'sparkles-outline', title: 'Generamos el plan', desc: 'Un itinerario por días, ordenado sobre el mapa.' },
  { icon: 'create-outline', title: 'Editalo y usalo', desc: 'Cambiá lo que quieras y seguilo durante el viaje.' },
] as const;

export default function HomeScreen() {
  const t = useTheme();
  const router = useRouter();

  return (
    <Screen>
      {/* Encabezado */}
      <View>
        <Label>{APP_NAME}</Label>
        <H1 style={{ marginTop: 2 }}>Hola 👋</H1>
      </View>

      {/* Hero: propuesta de valor + CTA principal */}
      <View style={[styles.hero, { backgroundColor: t.primary }]}>
        <View style={styles.heroGlow} />
        <Ionicons name="map" size={26} color={t.textOnPrimary} style={{ opacity: 0.9 }} />
        <H1 style={[styles.heroTitle, { color: t.textOnPrimary }]}>
          Armá tu viaje ideal en menos de 3 minutos
        </H1>
        <Body style={{ color: t.textOnPrimary, opacity: 0.92 }}>
          Decinos a dónde vas y te devolvemos un itinerario día por día, sobre el mapa, listo para usar.
        </Body>
        <Button
          title="Crear mi primer viaje"
          icon="add-circle"
          variant="secondary"
          onPress={() => router.push('/crear')}
          style={{ marginTop: Spacing.two }}
        />
      </View>

      {/* Cómo funciona */}
      <View style={{ gap: Spacing.two }}>
        <H2>Cómo funciona</H2>
        <View style={{ gap: Spacing.two }}>
          {STEPS.map((s, i) => (
            <Card key={s.title} style={styles.stepCard}>
              <View style={[styles.stepBadge, { backgroundColor: t.primarySoft }]}>
                <Ionicons name={s.icon as any} size={22} color={t.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Body style={{ fontWeight: '700' }}>
                  {i + 1}. {s.title}
                </Body>
                <Body muted style={{ fontSize: 14 }}>
                  {s.desc}
                </Body>
              </View>
            </Card>
          ))}
        </View>
      </View>

      {/* Vista previa de cómo se ve un día */}
      <View style={{ gap: Spacing.two }}>
        <H2>Así se ve un día</H2>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <View style={[styles.previewHeader, { borderBottomColor: t.border }]}>
            <View>
              <Label style={{ color: t.secondary }}>Día 1 · Centro histórico</Label>
              <Body style={{ fontWeight: '700', marginTop: 2 }}>Roma, Italia</Body>
            </View>
            <View style={[styles.pill, { backgroundColor: t.secondarySoft }]}>
              <Ionicons name="walk" size={14} color={t.secondary} />
              <Body style={{ fontSize: 12, color: t.secondary, fontWeight: '700' }}>4 paradas</Body>
            </View>
          </View>

          <View style={{ padding: Spacing.three, gap: 0 }}>
            <PreviewStop time="09:30" name="Coliseo" cat="Historia · 2 h" first color={t.primary} />
            <PreviewLeg t={t} text="7 min a pie · 550 m" />
            <PreviewStop time="12:00" name="Foro Romano" cat="Historia · 1.5 h" color={t.primary} />
            <PreviewLeg t={t} text="Almuerzo · 12 min" />
            <PreviewStop time="14:30" name="Trattoria Luzzi" cat="Gastronomía · 1 h" color={t.secondary} />
            <PreviewLeg t={t} text="10 min a pie · 800 m" />
            <PreviewStop time="16:00" name="Fontana di Trevi" cat="Icónico · 45 min" last color={t.secondary} />
          </View>
        </Card>
        <Body muted style={{ textAlign: 'center', fontSize: 13 }}>
          Es solo un ejemplo. El tuyo se arma con tus fechas e intereses.
        </Body>
      </View>
    </Screen>
  );
}

function PreviewStop({
  time,
  name,
  cat,
  first,
  last,
  color,
}: {
  time: string;
  name: string;
  cat: string;
  first?: boolean;
  last?: boolean;
  color: string;
}) {
  const t = useTheme();
  return (
    <View style={styles.stopRow}>
      <Body style={{ width: 48, fontSize: 13, color: t.textSecondary, fontWeight: '600' }}>{time}</Body>
      <View style={styles.timelineCol}>
        <View style={[styles.line, { backgroundColor: first ? 'transparent' : t.border }]} />
        <View style={[styles.dot, { backgroundColor: color, borderColor: t.surface }]} />
        <View style={[styles.line, { backgroundColor: last ? 'transparent' : t.border }]} />
      </View>
      <View style={{ flex: 1, paddingVertical: Spacing.one }}>
        <Body style={{ fontWeight: '700' }}>{name}</Body>
        <Body muted style={{ fontSize: 13 }}>
          {cat}
        </Body>
      </View>
    </View>
  );
}

function PreviewLeg({ t, text }: { t: ReturnType<typeof useTheme>; text: string }) {
  return (
    <View style={styles.legRow}>
      <View style={{ width: 48 }} />
      <View style={styles.timelineCol}>
        <View style={[styles.line, { backgroundColor: t.border }]} />
      </View>
      <View style={styles.legPill}>
        <Ionicons name="ellipse" size={5} color={t.textSecondary} />
        <Body muted style={{ fontSize: 12 }}>
          {text}
        </Body>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: Radius.xl,
    padding: Spacing.four,
    gap: Spacing.two,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    opacity: 0.12,
  },
  heroTitle: { fontSize: 26, lineHeight: 32 },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  stepBadge: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    borderBottomWidth: 1,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
  },
  stopRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'stretch' },
  legRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center', height: 34 },
  timelineCol: { width: 16, alignItems: 'center' },
  line: { flex: 1, width: 2 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  legPill: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
});
