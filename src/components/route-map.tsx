import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type MapStop = { id: string; lat: number; lng: number; name: string; index: number; color: string };

/**
 * Mapa esquemático para nativo (iOS/Android en Expo Go).
 * En la build nativa final se reemplaza por react-native-maps; en web se usa Leaflet (route-map.web.tsx).
 */
export function RouteMap({
  stops,
  selectedId,
  onSelect,
  height = 260,
}: {
  stops: MapStop[];
  accommodation?: { lat: number; lng: number; name: string } | null;
  selectedId?: string;
  onSelect?: (id: string) => void;
  height?: number;
}) {
  const t = useTheme();
  const W = 320;
  const H = height;
  const pad = 30;

  if (!stops.length) return <View style={[styles.wrap, { height, backgroundColor: t.secondarySoft }]} />;

  const lats = stops.map((s) => s.lat);
  const lngs = stops.map((s) => s.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const spanLat = maxLat - minLat || 0.001;
  const spanLng = maxLng - minLng || 0.001;

  const px = (s: MapStop) => pad + ((s.lng - minLng) / spanLng) * (W - pad * 2);
  const py = (s: MapStop) => pad + ((maxLat - s.lat) / spanLat) * (H - pad * 2);

  return (
    <View style={[styles.wrap, { height, backgroundColor: t.secondarySoft }]}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {stops.slice(0, -1).map((s, i) => (
          <Line key={`l${i}`} x1={px(s)} y1={py(s)} x2={px(stops[i + 1])} y2={py(stops[i + 1])} stroke={t.secondary} strokeWidth={2} strokeDasharray="2 6" opacity={0.6} />
        ))}
        {stops.map((s) => {
          const sel = s.id === selectedId;
          return (
            <React.Fragment key={s.id}>
              <Circle cx={px(s)} cy={py(s)} r={sel ? 15 : 12} fill={s.color} stroke="#fff" strokeWidth={2} onPress={() => onSelect?.(s.id)} />
              <SvgText x={px(s)} y={py(s) + 4} fontSize={11} fontWeight="700" fill="#fff" textAnchor="middle">
                {s.index}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: Radius.md, overflow: 'hidden' },
});
