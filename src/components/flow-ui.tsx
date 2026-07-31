import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Body } from './ui';

/** Barra superior con botón de volver y título opcional. */
export function TopBar({
  onBack,
  title,
  right,
}: {
  onBack?: () => void;
  title?: string;
  right?: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={styles.topShell}>
      <View style={styles.top}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={10} style={[styles.iconBtn, { backgroundColor: t.surface, borderColor: t.border }]} accessibilityRole="button" accessibilityLabel="Volver">
            <Ionicons name="chevron-back" size={22} color={t.text} />
          </Pressable>
        ) : (
          <View style={styles.iconBtn} />
        )}
        {title ? (
          <Body style={{ fontWeight: '700', flex: 1, textAlign: 'center' }} numberOfLines={1}>
            {title}
          </Body>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <View style={styles.iconBtn}>{right}</View>
      </View>
    </View>
  );
}

/** Barra de progreso segmentada (paso actual de N). */
export function ProgressBar({ step, total }: { step: number; total: number }) {
  const t = useTheme();
  return (
    <View style={styles.progressShell}>
      <View style={styles.progress}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 5,
              borderRadius: Radius.pill,
              backgroundColor: i <= step ? t.primary : t.border,
            }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topShell: { width: '100%', paddingHorizontal: Spacing.three },
  top: { width: '100%', maxWidth: 760, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  iconBtn: { width: 40, height: 40, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent' },
  progressShell: { width: '100%', paddingHorizontal: Spacing.three },
  progress: { width: '100%', maxWidth: 760, alignSelf: 'center', flexDirection: 'row', gap: 6, paddingBottom: Spacing.two },
});
