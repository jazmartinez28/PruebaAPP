import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Body, Button, Card, H1, Screen } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { cityById } from '@/data/cities';
import { useTheme } from '@/hooks/use-theme';
import { fmtRange } from '@/lib/dates';
import { tripStats } from '@/lib/generate';
import { tripStatusOf } from '@/lib/trip';
import { useStore } from '@/store/useStore';
import type { Trip, TripStatus } from '@/types';

const FILTERS: { id: TripStatus; label: string }[] = [
  { id: 'proximo', label: 'Próximos' },
  { id: 'encurso', label: 'En curso' },
  { id: 'finalizado', label: 'Finalizados' },
];

export default function ViajesScreen() {
  const t = useTheme();
  const router = useRouter();
  const trips = useStore((s) => s.trips);
  const [active, setActive] = useState<TripStatus>('proximo');

  const filtered = trips.filter((tr) => tripStatusOf(tr) === active);

  return (
    <Screen>
      <H1>Mis viajes</H1>

      <View style={styles.filters}>
        {FILTERS.map((f) => {
          const on = f.id === active;
          const count = trips.filter((tr) => tripStatusOf(tr) === f.id).length;
          return (
            <Pressable
              key={f.id}
              onPress={() => setActive(f.id)}
              style={[styles.filter, { backgroundColor: on ? t.text : t.surface, borderColor: on ? t.text : t.border }]}>
              <Body style={{ color: on ? t.background : t.textSecondary, fontWeight: '600', fontSize: 14 }}>
                {f.label}{count ? ` (${count})` : ''}
              </Body>
            </Pressable>
          );
        })}
      </View>

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: t.primarySoft }]}>
            <Ionicons name="airplane-outline" size={36} color={t.primary} />
          </View>
          <H1 style={{ fontSize: 22, textAlign: 'center' }}>
            {trips.length === 0 ? 'Todavía no tenés viajes' : 'Nada por acá'}
          </H1>
          <Body muted style={{ textAlign: 'center' }}>
            {active === 'proximo'
              ? 'Creá tu primer viaje y lo vas a ver acá, con su cuenta regresiva y su itinerario.'
              : 'No hay viajes en este estado.'}
          </Body>
          <Button title="Crear un viaje" icon="add" onPress={() => router.push('/crear')} style={{ marginTop: Spacing.two }} />
        </View>
      ) : (
        <View style={{ gap: Spacing.three }}>
          {filtered.map((tr) => (
            <TripCard key={tr.id} trip={tr} onOpen={() => router.push(`/viaje/${tr.id}`)} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function TripCard({ trip, onOpen }: { trip: Trip; onOpen: () => void }) {
  const t = useTheme();
  const city = cityById(trip.cityId);
  const stats = tripStats(trip.days);
  return (
    <Pressable onPress={onOpen}>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <LinearGradient colors={city?.gradient ?? [t.primary, t.primaryStrong]} style={styles.banner}>
          <Body style={{ fontSize: 40 }}>{city?.emoji}</Body>
          <View style={styles.bannerText}>
            <Body style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>{trip.cityName}</Body>
            <Body style={{ color: '#fff', opacity: 0.9, fontSize: 13 }}>{trip.country}</Body>
          </View>
        </LinearGradient>
        <View style={styles.cardBody}>
          <Info icon="calendar" text={fmtRange(trip.startDate, trip.endDate)} />
          <Info icon="today" text={`${stats.days} días`} />
          <Info icon="flag" text={`${stats.activities} act.`} />
        </View>
      </Card>
    </Pressable>
  );
}

function Info({ icon, text }: { icon: any; text: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Ionicons name={icon} size={15} color={t.textSecondary} />
      <Body muted style={{ fontSize: 13 }}>{text}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  filter: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: Radius.pill, borderWidth: 1.5 },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.six, paddingHorizontal: Spacing.three },
  emptyIcon: { width: 80, height: 80, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two },
  banner: { height: 120, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.four },
  bannerText: { flex: 1 },
  cardBody: { flexDirection: 'row', gap: Spacing.four, padding: Spacing.three, flexWrap: 'wrap' },
});
