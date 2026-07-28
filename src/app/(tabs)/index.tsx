import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Body, Button, Card, H1, H2, Label, Screen } from '@/components/ui';
import { APP_NAME } from '@/constants/config';
import { Radius, Spacing } from '@/constants/theme';
import { cityById } from '@/data/cities';
import { useTheme } from '@/hooks/use-theme';
import { daysUntil, fmtRange } from '@/lib/dates';
import { tripStats } from '@/lib/generate';
import { tripStatusOf } from '@/lib/trip';
import { useStore } from '@/store/useStore';
import type { Trip } from '@/types';

const STEPS = [
  { icon: 'options-outline', title: 'Contanos tu viaje', desc: 'Destino, fechas e intereses. En un minuto.' },
  { icon: 'sparkles-outline', title: 'Generamos el plan', desc: 'Un itinerario por días, ordenado sobre el mapa.' },
  { icon: 'create-outline', title: 'Editalo y usalo', desc: 'Cambiá lo que quieras y seguilo durante el viaje.' },
] as const;

export default function HomeScreen() {
  const t = useTheme();
  const router = useRouter();
  const trips = useStore((s) => s.trips);
  const user = useStore((s) => s.user);

  const sorted = [...trips].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const next = sorted.find((tr) => tripStatusOf(tr) !== 'finalizado') ?? sorted[sorted.length - 1];

  return (
    <Screen>
      <View>
        <Label>{APP_NAME}</Label>
        <H1 style={{ marginTop: 2 }}>Hola{user ? `, ${user.name.split(' ')[0]}` : ''} 👋</H1>
      </View>

      {next ? (
        <>
          <NextTripCard trip={next} onOpen={() => router.push(`/viaje/${next.id}`)} />
          <Button title="Crear otro viaje" icon="add" variant="ghost" size="md" onPress={() => router.push('/crear')} />

          {sorted.length > 1 && (
            <View style={{ gap: Spacing.two }}>
              <H2>Tus viajes</H2>
              {sorted
                .filter((tr) => tr.id !== next.id)
                .map((tr) => (
                  <MiniTrip key={tr.id} trip={tr} onOpen={() => router.push(`/viaje/${tr.id}`)} />
                ))}
            </View>
          )}
        </>
      ) : (
        <EmptyHome onCreate={() => router.push('/crear')} />
      )}
    </Screen>
  );
}

function NextTripCard({ trip, onOpen }: { trip: Trip; onOpen: () => void }) {
  const t = useTheme();
  const city = cityById(trip.cityId);
  const status = tripStatusOf(trip);
  const stats = tripStats(trip.days);
  const dLeft = daysUntil(trip.startDate);
  const countdown =
    status === 'encurso' ? '¡En viaje ahora!' : status === 'finalizado' ? 'Viaje finalizado' : dLeft === 0 ? '¡Es hoy!' : `Faltan ${dLeft} días`;

  return (
    <LinearGradient colors={city?.gradient ?? [t.primary, t.primaryStrong]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.next}>
      <View style={styles.nextTop}>
        <View style={styles.countdownPill}>
          <Ionicons name="time" size={13} color="#fff" />
          <Body style={styles.pillText}>{countdown}</Body>
        </View>
        <Body style={{ fontSize: 34 }}>{city?.emoji}</Body>
      </View>
      <Body style={styles.nextCity}>{trip.cityName}</Body>
      <Body style={{ color: '#fff', opacity: 0.9 }}>
        {fmtRange(trip.startDate, trip.endDate)} · {stats.days} días · {stats.activities} actividades
      </Body>
      <Button title="Ver itinerario" icon="arrow-forward" variant="secondary" size="md" onPress={onOpen} style={{ marginTop: Spacing.three, alignSelf: 'flex-start' }} />
    </LinearGradient>
  );
}

function MiniTrip({ trip, onOpen }: { trip: Trip; onOpen: () => void }) {
  const t = useTheme();
  const city = cityById(trip.cityId);
  return (
    <Pressable onPress={onOpen}>
      <Card style={styles.mini}>
        <LinearGradient colors={city?.gradient ?? [t.primary, t.primaryStrong]} style={styles.miniThumb}>
          <Body style={{ fontSize: 22 }}>{city?.emoji}</Body>
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Body style={{ fontWeight: '700' }}>{trip.cityName}</Body>
          <Body muted style={{ fontSize: 13 }}>{fmtRange(trip.startDate, trip.endDate)}</Body>
        </View>
        <Ionicons name="chevron-forward" size={18} color={t.textSecondary} />
      </Card>
    </Pressable>
  );
}

function EmptyHome({ onCreate }: { onCreate: () => void }) {
  const t = useTheme();
  return (
    <>
      <View style={[styles.hero, { backgroundColor: t.primary }]}>
        <View style={styles.heroGlow} />
        <Ionicons name="map" size={26} color={t.textOnPrimary} style={{ opacity: 0.9 }} />
        <H1 style={[styles.heroTitle, { color: t.textOnPrimary }]}>Armá tu viaje ideal en menos de 3 minutos</H1>
        <Body style={{ color: t.textOnPrimary, opacity: 0.92 }}>
          Decinos a dónde vas y te devolvemos un itinerario día por día, sobre el mapa, listo para usar.
        </Body>
        <Button title="Crear mi primer viaje" icon="add-circle" variant="secondary" onPress={onCreate} style={{ marginTop: Spacing.two }} />
      </View>

      <View style={{ gap: Spacing.two }}>
        <H2>Cómo funciona</H2>
        {STEPS.map((s, i) => (
          <Card key={s.title} style={styles.stepCard}>
            <View style={[styles.stepBadge, { backgroundColor: t.primarySoft }]}>
              <Ionicons name={s.icon as any} size={22} color={t.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Body style={{ fontWeight: '700' }}>{i + 1}. {s.title}</Body>
              <Body muted style={{ fontSize: 14 }}>{s.desc}</Body>
            </View>
          </Card>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  next: { borderRadius: Radius.xl, padding: Spacing.four, overflow: 'hidden' },
  nextTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  countdownPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill },
  pillText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  nextCity: { color: '#fff', fontSize: 30, fontWeight: '800', marginTop: Spacing.three },
  mini: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.two, paddingRight: Spacing.three },
  miniThumb: { width: 48, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: Radius.xl, padding: Spacing.four, gap: Spacing.two, overflow: 'hidden' },
  heroGlow: { position: 'absolute', top: -60, right: -40, width: 160, height: 160, borderRadius: 999, backgroundColor: '#FFFFFF', opacity: 0.12 },
  heroTitle: { fontSize: 26, lineHeight: 32 },
  stepCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  stepBadge: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
});
