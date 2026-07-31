import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';

import { Body } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type JourneyRouteProps = {
  labels?: string[];
  dark?: boolean;
  compact?: boolean;
  completion?: number;
};

/** Firma visual de Rumbo: una ruta que se revela una sola vez y conecta decisiones reales. */
export function JourneyRoute({ labels = [], dark = false, compact = false, completion = 1 }: JourneyRouteProps) {
  const t = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const [reducedMotion, setReducedMotion] = useState(false);
  const color = dark ? '#FFFFFF' : t.secondary;
  const muted = dark ? 'rgba(255,255,255,0.48)' : t.border;
  const nodes = compact ? 3 : 4;
  const target = Math.max(0, Math.min(1, completion));

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!mounted) return;
      setReducedMotion(reduced);
      if (reduced) {
        progress.setValue(1);
        return;
      }
      Animated.timing(progress, {
        toValue: 1,
        duration: 720,
        useNativeDriver: false,
      }).start();
    });
    return () => {
      mounted = false;
    };
  }, [progress]);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={labels.length ? `Ruta por ${labels.join(', ')}` : 'Ruta del viaje'}
      style={styles.shell}>
      <View style={[styles.track, { backgroundColor: muted }]}>
        <Animated.View
          style={[
            styles.trackFill,
            {
              backgroundColor: color,
              width: reducedMotion
                ? `${target * 100}%`
                : progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${target * 100}%`] }),
            },
          ]}
        />
      </View>
      <View style={styles.nodes}>
        {Array.from({ length: nodes }).map((_, index) => {
          const threshold = index / Math.max(nodes - 1, 1);
          const reached = threshold <= target + 0.02;
          const opacity = reached ? progress : 0.32;
          return (
            <View key={index} style={styles.nodeColumn}>
              <Animated.View
                style={[
                  styles.node,
                  {
                    borderColor: color,
                    backgroundColor: reached ? color : dark ? '#25323A' : t.surface,
                    opacity,
                    transform: [{ scale: reducedMotion || !reached ? 1 : progress }],
                  },
                ]}
              />
              {labels[index] ? (
                <Body
                  numberOfLines={1}
                  style={[styles.label, { color: dark ? 'rgba(255,255,255,0.78)' : t.textSecondary }]}>
                  {labels[index]}
                </Body>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { minHeight: 38, justifyContent: 'center' },
  track: { position: 'absolute', left: 8, right: 8, top: 9, height: 2, borderRadius: Radius.pill, overflow: 'hidden' },
  trackFill: { height: 2, borderRadius: Radius.pill },
  nodes: { flexDirection: 'row', justifyContent: 'space-between' },
  nodeColumn: { width: 62, alignItems: 'center', gap: 6 },
  node: { width: 18, height: 18, borderRadius: 9, borderWidth: 4 },
  label: { width: 70, textAlign: 'center', fontSize: 10, lineHeight: 13, fontWeight: '700' },
});
