import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Body, H1 } from '@/components/ui';
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
  const resetDraft = useStore((s) => s.resetDraft);
  const [stage, setStage] = useState(0);
  const done = useRef(false);
  const city = draft.cityId ? cityById(draft.cityId) : undefined;

  useEffect(() => {
    if (!draft.cityId || !draft.startDate) {
      router.replace('/');
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    STAGES.forEach((_, i) => {
      timers.push(setTimeout(() => setStage(i), i * 520));
    });
    timers.push(
      setTimeout(() => {
        if (done.current) return;
        done.current = true;
        const res = createTrip();
        if (res.error === 'limit') {
          router.replace('/paywall');
        } else if (res.id) {
          const id = res.id;
          resetDraft();
          router.replace(`/viaje/${id}`);
        } else {
          router.replace('/');
        }
      }, STAGES.length * 520 + 400),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LinearGradient colors={city?.gradient ?? [t.primary, t.primaryStrong]} style={styles.fill}>
      <View style={styles.center}>
        <View style={styles.emojiWrap}>
          <Body style={{ fontSize: 64 }}>{city?.emoji ?? '🗺️'}</Body>
        </View>
        <H1 style={{ color: '#fff', textAlign: 'center' }}>Armando tu viaje a {city?.name ?? 'destino'}…</H1>
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
  emojiWrap: {
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
});
