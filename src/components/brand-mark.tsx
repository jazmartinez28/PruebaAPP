import { StyleSheet, View } from 'react-native';

import { Body } from '@/components/ui';
import { APP_NAME } from '@/constants/config';
import { useTheme } from '@/hooks/use-theme';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  const t = useTheme();
  return (
    <View style={styles.row} accessibilityLabel={APP_NAME}>
      <View style={[styles.symbol, { backgroundColor: t.primary }]}>
        <View style={styles.route} />
        <View style={[styles.origin, { borderColor: t.primary }]} />
        <View style={[styles.destination, { borderColor: t.primary }]} />
      </View>
      {!compact && (
        <Body style={[styles.wordmark, { color: t.text }]}>
          {APP_NAME}
        </Body>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  symbol: { width: 34, height: 34, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  route: { width: 16, height: 2, backgroundColor: '#FFFFFF', transform: [{ rotate: '-34deg' }] },
  origin: { position: 'absolute', left: 7, bottom: 7, width: 9, height: 9, borderRadius: 5, backgroundColor: '#FFFFFF', borderWidth: 2 },
  destination: { position: 'absolute', right: 6, top: 6, width: 11, height: 11, borderRadius: 6, backgroundColor: '#FFFFFF', borderWidth: 2 },
  wordmark: { fontSize: 21, lineHeight: 24, fontWeight: '900', letterSpacing: -0.7 },
});
