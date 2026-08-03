import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageStyle } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Body } from '@/components/ui';
import { categoryVisualFor } from '@/lib/category-style';
import { resolvePlaceImage } from '@/lib/place-images';
import type { Place } from '@/types';

const PHOTO = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=78`;
const CATEGORY_PHOTOS = {
  gastronomia: PHOTO('1414235077428-338989a2e8c0'),
  cultura: PHOTO('1561214115-f2f134cc4912'),
  arquitectura: PHOTO('1487958449943-2429e8be8625'),
  naturaleza: PHOTO('1500530855697-b586d89ba3ee'),
  compras: PHOTO('1441986300917-64674bd600d8'),
  noche: PHOTO('1514525253161-7a46d19cd819'),
  deportes: PHOTO('1461896836934-ffe607ba8211'),
  local: PHOTO('1477959858617-67f85cf4f1df'),
} as const;

function categoryPhotoFor(place: Place) {
  if (place.isMeal || place.categories.includes('gastronomia')) return CATEGORY_PHOTOS.gastronomia;
  if (place.categories.some((category) => ['museos', 'arte', 'musica'].includes(category))) return CATEGORY_PHOTOS.cultura;
  if (place.categories.some((category) => ['arquitectura', 'historia', 'iconico'].includes(category))) return CATEGORY_PHOTOS.arquitectura;
  if (place.categories.some((category) => ['parques', 'naturaleza', 'fotografia'].includes(category))) return CATEGORY_PHOTOS.naturaleza;
  if (place.categories.includes('compras')) return CATEGORY_PHOTOS.compras;
  if (place.categories.includes('vidanocturna')) return CATEGORY_PHOTOS.noche;
  if (place.categories.includes('deportes')) return CATEGORY_PHOTOS.deportes;
  return CATEGORY_PHOTOS.local;
}

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

  const sourceUri = [place.imageUrl, resolvedUri, categoryPhotoFor(place)].find((uri) => uri && !failedUris.includes(uri));

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
