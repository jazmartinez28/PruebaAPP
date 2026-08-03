import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { Radius } from '@/constants/theme';

export type MapStop = { id: string; lat: number; lng: number; name: string; index: number; color: string };

export function RouteMap({
  stops,
  accommodation,
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
  const mapRef = useRef<MapView>(null);
  const coordinates = useMemo(() => {
    const route = stops.map((stop) => ({ latitude: stop.lat, longitude: stop.lng }));
    return accommodation && route.length
      ? [{ latitude: accommodation.lat, longitude: accommodation.lng }, ...route, { latitude: accommodation.lat, longitude: accommodation.lng }]
      : route;
  }, [accommodation, stops]);

  useEffect(() => {
    if (!coordinates.length) return;
    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(coordinates, {
        animated: true,
        edgePadding: { top: 54, right: 42, bottom: 88, left: 42 },
      });
    }, 120);
    return () => clearTimeout(timer);
  }, [coordinates]);

  useEffect(() => {
    const selected = stops.find((stop) => stop.id === selectedId);
    if (!selected) return;
    mapRef.current?.animateCamera({ center: { latitude: selected.lat, longitude: selected.lng }, zoom: 15 }, { duration: 340 });
  }, [selectedId, stops]);

  const center = coordinates[0] ?? { latitude: 0, longitude: 0 };
  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{ ...center, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsCompass={false}
        showsPointsOfInterests
        accessibilityLabel="Mapa del recorrido del día">
        {coordinates.length > 1 && (
          <>
            <Polyline coordinates={coordinates} strokeColor="rgba(255,255,255,0.95)" strokeWidth={8} />
            <Polyline coordinates={coordinates} strokeColor="#16A085" strokeWidth={4} lineCap="round" lineJoin="round" />
          </>
        )}
        {accommodation && (
          <Marker coordinate={{ latitude: accommodation.lat, longitude: accommodation.lng }} title={accommodation.name}>
            <View style={styles.hotelMarker}><Text style={styles.hotelMarkerText}>H</Text></View>
          </Marker>
        )}
        {stops.map((stop) => {
          const selected = stop.id === selectedId;
          return (
            <Marker
              key={stop.id}
              coordinate={{ latitude: stop.lat, longitude: stop.lng }}
              title={stop.name}
              onPress={() => onSelect?.(stop.id)}
              tracksViewChanges={selected}>
              <View style={[styles.marker, { backgroundColor: stop.color }, selected && styles.markerSelected]}>
                <Text style={styles.markerText}>{stop.index}</Text>
              </View>
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: Radius.md, overflow: 'hidden', backgroundColor: '#DDEBE8' },
  marker: { width: 32, height: 32, borderRadius: 16, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#101828', shadowOpacity: 0.22, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  markerSelected: { width: 40, height: 40, borderRadius: 20, borderWidth: 4 },
  markerText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  hotelMarker: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#1D2733', borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#101828', shadowOpacity: 0.24, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 5 },
  hotelMarkerText: { color: '#fff', fontSize: 13, fontWeight: '900' },
});
