import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Body, Button, H1, Screen } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const FILTERS = ['Próximos', 'En curso', 'Finalizados'] as const;

export default function ViajesScreen() {
  const t = useTheme();
  const router = useRouter();
  const [active, setActive] = useState<(typeof FILTERS)[number]>('Próximos');

  return (
    <Screen>
      <H1>Mis viajes</H1>

      <View style={styles.filters}>
        {FILTERS.map((f) => {
          const on = f === active;
          return (
            <Pressable
              key={f}
              onPress={() => setActive(f)}
              style={[
                styles.filter,
                { backgroundColor: on ? t.text : t.surface, borderColor: on ? t.text : t.border },
              ]}>
              <Body style={{ color: on ? t.background : t.textSecondary, fontWeight: '600', fontSize: 14 }}>
                {f}
              </Body>
            </Pressable>
          );
        })}
      </View>

      {/* Estado vacío */}
      <View style={styles.empty}>
        <View style={[styles.emptyIcon, { backgroundColor: t.primarySoft }]}>
          <Ionicons name="airplane-outline" size={36} color={t.primary} />
        </View>
        <H1 style={{ fontSize: 22, textAlign: 'center' }}>Todavía no tenés viajes</H1>
        <Body muted style={{ textAlign: 'center' }}>
          Creá tu primer viaje y lo vas a ver acá, con su cuenta regresiva y su itinerario.
        </Body>
        <Button title="Crear un viaje" icon="add" onPress={() => router.push('/crear')} style={{ marginTop: Spacing.two }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  filter: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: Radius.pill, borderWidth: 1.5 },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.six, paddingHorizontal: Spacing.three },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
});
