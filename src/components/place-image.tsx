import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageStyle } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Body } from '@/components/ui';
import { cityById } from '@/data/cities';
import { categoryVisualFor } from '@/lib/category-style';
import { resolvePlaceImage } from '@/lib/place-images';
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
  const city = cityById(place.cityId);
  const [resolvedUri, setResolvedUri] = useState<string | null>(null);
  const [failedUris, setFailedUris] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    setResolvedUri(null);
    setFailedUris([]);
    if (!place.imageUrl) {
      void resolvePlaceImage(place).then((uri) => {
        if (active) setResolvedUri(uri);
      });
    }
    return () => { active = false; };
  }, [place]);

  useEffect(() => {
    if (!place.imageUrl || !failedUris.includes(place.imageUrl) || resolvedUri) return;
    let active = true;
    void resolvePlaceImage({ ...place, imageUrl: undefined }).then((uri) => {
      if (active) setResolvedUri(uri);
    });
    return () => { active = false; };
  }, [failedUris, place, resolvedUri]);

  const sourceUri = [place.imageUrl, resolvedUri, city?.image].find((uri) => uri && !failedUris.includes(uri));

  if (sourceUri) {
    return (
      <Image
        accessibilityLabel={`Fotografía de ${place.name}`}
        source={{ uri: sourceUri }}
        placeholder={{ blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj' }}
        transition={220}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={place.id}
        onError={() => setFailedUris((current) => current.includes(sourceUri) ? current : [...current, sourceUri])}
        style={style as StyleProp<ImageStyle>}
      />
    );
  }
  return (
    <View
      accessibilityLabel={`Imagen no disponible para ${place.name}`}
      style={[styles.fallback, { backgroundColor: visual.soft }, style as StyleProp<ViewStyle>]}>
      <View style={[styles.icon, compact && styles.iconCompact, { backgroundColor: visual.color }]}>
        <Ionicons name={visual.icon} size={compact ? 16 : 28} color="#fff" />
      </View>
      {!compact && <Body style={{ color: visual.color, fontWeight: '900', fontSize: 12 }}>{visual.label}</Body>}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden' },
  icon: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  iconCompact: { width: 32, height: 32, borderRadius: 10 },
});
