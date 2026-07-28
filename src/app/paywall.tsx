import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, H1 } from '@/components/ui';
import { REMOTE_CONFIG } from '@/constants/config';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/store/useStore';

const BENEFITS = [
  'Viajes ilimitados',
  'Muchas más alternativas al reemplazar',
  'Reorganización inteligente durante el viaje',
  'Descarga offline y exportación',
  'Filtros y personalización avanzada',
  'Sin anuncios',
];

export default function PaywallScreen() {
  const t = useTheme();
  const router = useRouter();
  const upgrade = useStore((s) => s.upgradeToPremium);
  const createTrip = useStore((s) => s.createTripFromDraft);
  const resetDraft = useStore((s) => s.resetDraft);
  const draft = useStore((s) => s.draft);
  const [plan, setPlan] = useState<'mensual' | 'viaje'>('mensual');

  const activate = () => {
    upgrade();
    if (draft.cityId && draft.startDate) {
      const res = createTrip();
      if (res.id) {
        resetDraft();
        router.replace(`/viaje/${res.id}`);
        return;
      }
    }
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.background }}>
      <View style={{ alignItems: 'flex-end', padding: Spacing.three }}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={t.textSecondary} />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: Spacing.four, gap: Spacing.three, flex: 1 }}>
        <LinearGradient colors={[t.primary, t.primaryStrong]} style={styles.crown}>
          <Ionicons name="star" size={30} color="#fff" />
        </LinearGradient>
        <H1 style={{ textAlign: 'center' }}>Pasate a Premium</H1>
        <Body muted style={{ textAlign: 'center' }}>
          Desbloqueá todo el potencial para planear sin límites.
        </Body>

        <View style={{ gap: Spacing.two, marginTop: Spacing.two }}>
          {BENEFITS.map((b) => (
            <View key={b} style={styles.benefit}>
              <Ionicons name="checkmark-circle" size={20} color={t.secondary} />
              <Body style={{ flex: 1 }}>{b}</Body>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two }}>
          <PlanCard title="Mensual" price={REMOTE_CONFIG.premiumMonthly} selected={plan === 'mensual'} onPress={() => setPlan('mensual')} />
          <PlanCard title="Por viaje" price={REMOTE_CONFIG.premiumPerTrip} selected={plan === 'viaje'} onPress={() => setPlan('viaje')} />
        </View>
      </View>

      <View style={{ padding: Spacing.four, gap: Spacing.two }}>
        <Button title="Activar Premium" icon="sparkles" onPress={activate} />
        <Button title="Ahora no" variant="ghost" size="md" onPress={() => router.back()} />
        <Body muted style={{ fontSize: 11, textAlign: 'center' }}>
          Precios de prueba. Podés cancelar cuando quieras.
        </Body>
      </View>
    </SafeAreaView>
  );
}

function PlanCard({ title, price, selected, onPress }: { title: string; price: string; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.plan, { borderColor: selected ? t.primary : t.border, backgroundColor: selected ? t.primarySoft : t.surface }]}>
      <Body style={{ fontWeight: '700' }}>{title}</Body>
      <Body style={{ fontWeight: '800', fontSize: 16, color: selected ? t.primaryStrong : t.text }}>{price}</Body>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  crown: { width: 64, height: 64, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  plan: { flex: 1, borderWidth: 2, borderRadius: Radius.lg, padding: Spacing.three, gap: 4, alignItems: 'center' },
});
