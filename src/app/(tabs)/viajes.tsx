import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BrandMark } from '@/components/brand-mark';
import { CityImage } from '@/components/city-image';
import { JourneyRoute } from '@/components/journey-route';
import { Body, Button, Card, H1, H2, Label, Screen } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { cityById } from '@/data/cities';
import { useTheme } from '@/hooks/use-theme';
import { daysUntil, fmtRange } from '@/lib/dates';
import { tripStats } from '@/lib/generate';
import { tripStatusOf } from '@/lib/trip';
import { useStore } from '@/store/useStore';
import type { Trip, TripStatus } from '@/types';

const FILTERS: { id: TripStatus; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'proximo', label: 'Próximos', icon: 'sunny-outline' },
  { id: 'encurso', label: 'En curso', icon: 'navigate-outline' },
  { id: 'finalizado', label: 'Recuerdos', icon: 'images-outline' },
];

export default function ViajesScreen() {
  const t = useTheme();
  const router = useRouter();
  const trips = useStore((s) => s.trips);
  const [active, setActive] = useState<TripStatus>(() =>
    trips.some((trip) => tripStatusOf(trip) === 'encurso') ? 'encurso' : 'proximo',
  );
  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((filter) => [filter.id, trips.filter((trip) => tripStatusOf(trip) === filter.id).length])),
    [trips],
  ) as Record<TripStatus, number>;
  const filtered = useMemo(
    () => trips.filter((trip) => tripStatusOf(trip) === active).sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [active, trips],
  );

  const chooseFilter = (status: TripStatus) => {
    void Haptics.selectionAsync();
    setActive(status);
  };

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <BrandMark />
          <H1 style={styles.title}>Tus viajes, en un solo lugar</H1>
          <Body muted style={styles.subtitle}>Planes, reservas y recuerdos listos cuando los necesitás.</Body>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Crear un nuevo viaje"
          onPress={() => router.push('/crear')}
          style={({ pressed }) => [styles.create, { backgroundColor: t.primary }, pressed && styles.pressed]}>
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={[styles.filters, { backgroundColor: t.backgroundElement, borderColor: t.border }]} accessibilityRole="tablist">
        {FILTERS.map((filter) => {
          const selected = filter.id === active;
          return (
            <Pressable
              key={filter.id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => chooseFilter(filter.id)}
              style={({ pressed }) => [
                styles.filter,
                selected && { backgroundColor: t.text },
                pressed && styles.pressed,
              ]}>
              <Ionicons name={filter.icon} size={16} color={selected ? t.background : t.textSecondary} />
              <Body numberOfLines={1} style={{ color: selected ? t.background : t.textSecondary, fontWeight: '800', fontSize: 12 }}>
                {filter.label}
              </Body>
              <View style={[styles.count, { backgroundColor: selected ? 'rgba(255,255,255,0.18)' : t.background }]}>
                <Body style={{ color: selected ? t.background : t.text, fontSize: 10, fontWeight: '900' }}>{counts[filter.id]}</Body>
              </View>
            </Pressable>
          );
        })}
      </View>

      {filtered.length === 0 ? (
        <EmptyTrips hasTrips={trips.length > 0} active={active} onCreate={() => router.push('/crear')} />
      ) : (
        <View style={styles.collection}>
          <View style={styles.collectionHeading}>
            <View>
              <Label style={{ color: t.secondary }}>{active === 'finalizado' ? 'TU HISTORIA' : 'EN TU HORIZONTE'}</Label>
              <H2>{active === 'encurso' ? 'Tu aventura de hoy' : active === 'finalizado' ? 'Viajes que ya son parte tuya' : 'Lo próximo empieza acá'}</H2>
            </View>
            <Body muted style={{ fontSize: 12 }}>{filtered.length} {filtered.length === 1 ? 'viaje' : 'viajes'}</Body>
          </View>

          {filtered.map((trip, index) => (
            <TripCard
              key={trip.id}
              trip={trip}
              featured={index === 0}
              onOpen={() => router.push(`/viaje/${trip.id}`)}
              onPlan={() => router.push({ pathname: '/viaje/[id]', params: { id: trip.id, tab: 'itinerario' } })}
              onPacking={() => router.push({ pathname: '/viaje/[id]', params: { id: trip.id, tab: 'valija' } })}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function TripCard({ trip, featured, onOpen, onPlan, onPacking }: { trip: Trip; featured: boolean; onOpen: () => void; onPlan: () => void; onPacking: () => void }) {
  const t = useTheme();
  const city = cityById(trip.cityId);
  const stats = tripStats(trip.days);
  const status = tripStatusOf(trip);
  const packing = trip.packingItems ?? [];
  const packed = packing.filter((item) => item.packed).length;
  const readinessChecks = [Boolean(trip.accommodation), packing.length > 0 && packed === packing.length, (trip.tickets ?? []).length > 0];
  const readiness = Math.max(18, Math.round((readinessChecks.filter(Boolean).length / readinessChecks.length) * 100));
  const zones = Array.from(new Set(trip.days.map((day) => day.zone).filter(Boolean))).slice(0, 3);
  const daysLeft = daysUntil(trip.startDate);
  const badge = status === 'encurso' ? 'Viajando ahora' : status === 'finalizado' ? 'Viaje finalizado' : daysLeft <= 1 ? 'Empieza muy pronto' : `Faltan ${daysLeft} días`;

  if (!featured) {
    return (
      <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [pressed && styles.cardPressed]}>
        <Card style={styles.compactCard}>
          <CityImage city={city} scrim={0.12} style={styles.compactImage} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Body numberOfLines={1} style={{ fontSize: 18, fontWeight: '900' }}>{trip.cityName}</Body>
            <Body muted numberOfLines={1} style={{ fontSize: 12 }}>{fmtRange(trip.startDate, trip.endDate)} · {stats.days} días</Body>
            <View style={[styles.miniProgress, { backgroundColor: t.border }]}>
              <View style={[styles.miniProgressFill, { width: `${readiness}%`, backgroundColor: t.secondary }]} />
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={t.textSecondary} />
        </Card>
      </Pressable>
    );
  }

  return (
    <View style={[styles.featuredShell, { backgroundColor: t.surface, borderColor: t.border }]}>
      <CityImage city={city} scrim={0.42} style={styles.featuredImage}>
        <View style={styles.featuredTop}>
          <View style={styles.statusBadge}><View style={[styles.statusDot, { backgroundColor: status === 'finalizado' ? '#FFFFFF' : '#65D6B9' }]} /><Body style={styles.statusText}>{badge}</Body></View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Abrir viaje a ${trip.cityName}`} onPress={onOpen} style={styles.openCircle}>
            <Ionicons name="arrow-up-outline" size={19} color="#FFFFFF" style={{ transform: [{ rotate: '45deg' }] }} />
          </Pressable>
        </View>
        <View style={styles.featuredCopy}>
          <Body style={styles.country}>{trip.country.toUpperCase()}</Body>
          <Body style={styles.city}>{trip.cityName}</Body>
          <Body style={styles.date}>{fmtRange(trip.startDate, trip.endDate)} · {stats.days} días · {stats.activities} actividades</Body>
        </View>
        <JourneyRoute dark labels={zones.length ? zones : ['Llegada', 'Explorar', 'Disfrutar', 'Regreso']} />
      </CityImage>

      <View style={styles.readiness}>
        <View style={styles.readinessTop}>
          <View>
            <Label>PREPARACIÓN DEL VIAJE</Label>
            <Body style={{ fontWeight: '900', marginTop: 2 }}>{readiness}% listo para salir</Body>
          </View>
          <View style={[styles.readinessNumber, { backgroundColor: t.secondarySoft }]}><Body style={{ color: t.secondary, fontWeight: '900' }}>{readiness}%</Body></View>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: t.border }]}><View style={[styles.progressFill, { width: `${readiness}%`, backgroundColor: t.secondary }]} /></View>
        <View style={styles.quickActions}>
          <QuickAction icon="today-outline" label="Abrir plan" tone={t.primary} onPress={onPlan} />
          <QuickAction icon="bag-check-outline" label={packing.length ? `${packed}/${packing.length} valija` : 'Armar valija'} tone={t.secondary} onPress={onPacking} />
          <QuickAction icon="ticket-outline" label={`${trip.tickets?.length ?? 0} tickets`} tone={t.warning} onPress={onOpen} />
        </View>
      </View>
    </View>
  );
}

function QuickAction({ icon, label, tone, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; tone: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}>
      <Ionicons name={icon} size={18} color={tone} />
      <Body numberOfLines={1} style={{ fontSize: 11, fontWeight: '800' }}>{label}</Body>
    </Pressable>
  );
}

function EmptyTrips({ hasTrips, active, onCreate }: { hasTrips: boolean; active: TripStatus; onCreate: () => void }) {
  const t = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyVisual, { backgroundColor: t.text }]}>
        <View style={styles.emptyStamp}><Ionicons name="paper-plane" size={18} color="#FFFFFF" /></View>
        <Body style={styles.emptyEyebrow}>TU PRÓXIMA HISTORIA</Body>
        <H1 style={styles.emptyTitle}>{hasTrips ? 'Nada por acá todavía' : 'Un viaje increíble empieza con un buen plan'}</H1>
        <JourneyRoute dark labels={['Elegís', 'Organizamos', 'Viajás', 'Recordás']} />
      </View>
      <View style={styles.emptyCopy}>
        <H2>{active === 'finalizado' ? 'Tus recuerdos van a vivir acá' : 'De “¿qué hacemos?” a un día resuelto'}</H2>
        <Body muted>Destino, horarios, zonas, traslados y pausas conectados en menos de tres minutos.</Body>
        <Button title="Planificar mi viaje" icon="sparkles-outline" onPress={onCreate} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  title: { fontSize: 29, lineHeight: 34, marginTop: 4, maxWidth: 470 },
  subtitle: { marginTop: 5, maxWidth: 520 },
  create: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  pressed: { opacity: 0.74 },
  filters: { marginHorizontal: Spacing.three, padding: 5, borderWidth: 1, borderRadius: 18, flexDirection: 'row', gap: 4 },
  filter: { flex: 1, minHeight: 44, borderRadius: 14, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  count: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  collection: { paddingHorizontal: Spacing.three, gap: Spacing.three },
  collectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  featuredShell: { borderRadius: 25, overflow: 'hidden', borderWidth: 1, boxShadow: '0 16px 36px rgba(29,39,51,0.12)' },
  featuredImage: { minHeight: 360, padding: 20, justifyContent: 'space-between' },
  featuredTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusBadge: { minHeight: 36, paddingHorizontal: 11, borderRadius: Radius.pill, backgroundColor: 'rgba(15,22,28,0.44)', flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  openCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.52)', backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center' },
  featuredCopy: { marginTop: 'auto', marginBottom: 22 },
  country: { color: 'rgba(255,255,255,0.76)', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  city: { color: '#FFFFFF', fontSize: 38, lineHeight: 43, fontWeight: '900', letterSpacing: -0.8 },
  date: { color: '#FFFFFF', opacity: 0.9, marginTop: 5, fontWeight: '600' },
  readiness: { padding: 18, gap: 13 },
  readinessTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  readinessNumber: { minWidth: 54, height: 40, paddingHorizontal: 10, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 7, borderRadius: Radius.pill, overflow: 'hidden' },
  progressFill: { height: 7, borderRadius: Radius.pill },
  quickActions: { flexDirection: 'row', gap: 7 },
  quickAction: { flex: 1, minHeight: 48, paddingHorizontal: 7, borderRadius: 13, alignItems: 'center', justifyContent: 'center', gap: 3 },
  compactCard: { minHeight: 92, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 19 },
  compactImage: { width: 76, height: 74, borderRadius: 15 },
  cardPressed: { opacity: 0.84, transform: [{ scale: 0.99 }] },
  miniProgress: { height: 4, borderRadius: Radius.pill, marginTop: 9, overflow: 'hidden' },
  miniProgressFill: { height: 4, borderRadius: Radius.pill },
  empty: { marginHorizontal: Spacing.three, borderRadius: 25, overflow: 'hidden' },
  emptyVisual: { minHeight: 270, padding: 22, justifyContent: 'space-between' },
  emptyStamp: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  emptyEyebrow: { color: '#65D6B9', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  emptyTitle: { color: '#FFFFFF', fontSize: 29, lineHeight: 34, maxWidth: 500 },
  emptyCopy: { padding: 20, gap: 12, backgroundColor: '#FFFFFF' },
});
