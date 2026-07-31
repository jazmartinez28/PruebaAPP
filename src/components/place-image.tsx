import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageStyle } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Body } from '@/components/ui';
import { categoryVisualFor } from '@/lib/category-style';
import type { Place } from '@/types';

export function PlaceImage({
  place,
  style,
  compact = false,
}: {
  place: Place;
  style?: StyleProp<ViewStyle | ImageStyle>;
  compact?: boolean;
}) {
  const visual = categoryVisualFor(place);
  if (place.imageUrl) {
    return (
      <Image
        accessibilityLabel={`Imagen de ${place.name}`}
        source={{ uri: place.imageUrl }}
        placeholder={{ blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj' }}
        transition={220}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={place.id}
        style={style as StyleProp<ImageStyle>}
      />
    );
  }
  return (
    <View
      accessibilityLabel={`Sin imagen verificada para ${place.name}`}
      style={[styles.fallback, { backgroundColor: visual.soft }, style as StyleProp<ViewStyle>]}>
      <View style={[styles.icon, compact && styles.iconCompact, { backgroundColor: visual.color }]}>
        <Ionicons name={visual.icon} size={compact ? 16 : 28} color="#fff" />
      </View>
      {!compact && <Body style={{ color: visual.color, fontWeight: '900', fontSize: 12 }}>Imagen no verificada</Body>}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden' },
  icon: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  iconCompact: { width: 32, height: 32, borderRadius: 10 },
});
