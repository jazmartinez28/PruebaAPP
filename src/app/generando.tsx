import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Body, H1 } from '@/components/ui';
import { JourneyRoute } from '@/components/journey-route';
import { cityById } from '@/data/cities';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/store/useStore';

const STAGES = [
  'Analizando tus preferencias',
  'Buscando los mejores lugares',
  'Revisando horarios de apertura',
  'Agrupando actividades por zona',
  'Calculando distancias y traslados',
  'Organizando cada día',
  'Verificando el recorrido',
];

export default function GenerandoScreen() {
  const t = useTheme();
  const router = useRouter();
  const draft = useStore((s) => s.draft);
  const createTrip = useStore((s) => s.createTripFromDraft);
  const loadCityCatalog = useStore((s) => s.loadCityCatalog);
  const loadTripEvents = useStore((s) => s.loadTripEvents);
  const resetDraft = useStore((s) => s.resetDraft);
  const [stage, setStage] = useState(0);
  const done = useRef(false);
  const city = draft.cityId ? cityById(draft.cityId) : undefined;

  useEffect(() => {
    const accommodationComplete = Boolean(draft.accommodationChoice) &&
      (draft.accommodationChoice !== 'yes' || Boolean(draft.accommodation));
    if (!draft.cityId || !draft.startDate || !draft.endDate || !accommodationComplete || !draft.interests.length || !draft.partySize || !draft.groupType) {
      router.replace('/crear');
      return;
    }
    let cancelled = false;
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const run = async () => {
      setStage(0);
      await wait(350);
      setStage(1);
      await loadCityCatalog(draft.cityId!);
      if (draft.endDate) {
        await loadTripEvents(draft.cityId!, draft.startDate!, draft.endDate);
      }
      for (let index = 2; index < STAGES.length; index++) {
        if (cancelled) return;
        setStage(index);
        await wait(360);
      }
      if (cancelled || done.current) return;
      done.current = true;
      const res = createTrip();
      if (res.error === 'limit') {
        router.replace('/paywall');
      } else if (res.error === 'invalid') {
        router.replace('/crear');
      } else if (res.id) {
        const id = res.id;
        resetDraft();
        router.replace(`/viaje/${id}`);
      } else {
        router.replace('/');
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LinearGradient colors={city?.gradient ?? [t.primary, t.primaryStrong]} style={styles.fill}>
      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <Ionicons name="map-outline" size={52} color="#FFFFFF" />
        </View>
        <H1 style={{ color: '#fff', textAlign: 'center' }}>Armando tu viaje a {city?.name ?? 'destino'}…</H1>
        <Body style={styles.promise}>Conectamos cada elección en una ruta que funcione de verdad.</Body>
        <View style={styles.routeCard}>
          <JourneyRoute dark labels={['Tu base', 'Mañana', 'Tarde', 'Regreso']} />
        </View>
        <View style={{ height: Spacing.four }} />

        <View style={styles.stages}>
          {STAGES.map((label, i) => {
            const active = i === stage;
            const complete = i < stage;
            return (
              <View key={label} style={styles.stageRow}>
                {complete ? (
                  <Ionicons name="checkmark-circle" size={22} color="#fff" />
                ) : active ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="ellipse-outline" size={22} color="rgba(255,255,255,0.4)" />
                )}
                <Body
                  style={{
                    color: '#fff',
                    opacity: complete || active ? 1 : 0.5,
                    fontWeight: active ? '700' : '500',
                  }}>
                  {label}
                </Body>
              </View>
            );
          })}
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.four, gap: Spacing.two },
  iconWrap: {
    width: 110,
    height: 110,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.three,
  },
  stages: { gap: Spacing.three, alignSelf: 'center' },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 24 },
  promise: { color: 'rgba(255,255,255,0.78)', textAlign: 'center', alignSelf: 'center', maxWidth: 420 },
  routeCard: { width: '100%', maxWidth: 430, alignSelf: 'center', marginTop: Spacing.three, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: 'rgba(0,0,0,0.16)' },
});
