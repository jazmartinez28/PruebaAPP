import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { City } from '@/data/cities';

/**
 * Imagen de destino: foto real (Unsplash) sobre el degradado de marca.
 * Si la foto no carga, queda el degradado de fondo. Capa oscura opcional para legibilidad del texto.
 */
export function CityImage({
  city,
  style,
  scrim = 0.3,
  children,
}: {
  city?: City;
  style?: StyleProp<ViewStyle>;
  scrim?: number;
  children?: React.ReactNode;
}) {
  const gradient = city?.gradient ?? ['#FF8A5B', '#F2542D'];
  return (
    <View style={[styles.wrap, style]}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {city?.image ? (
        <Image source={{ uri: city.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} cachePolicy="memory-disk" />
      ) : null}
      {scrim > 0 && <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${scrim})` }]} />}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: '#eee' },
});
