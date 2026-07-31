import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

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
  const containerRef = useRef<any>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});

  // init
  useEffect(() => {
    const el = containerRef.current as unknown as HTMLElement;
    if (!el || mapRef.current) return;
    const map = L.map(el, { zoomControl: false, attributionControl: false }).setView([0, 0], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // draw
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // limpiar capas previas (menos tiles)
    map.eachLayer((layer) => {
      if (!(layer instanceof L.TileLayer)) map.removeLayer(layer);
    });
    markersRef.current = {};

    const routePts: [number, number][] = stops.map((s) => [s.lat, s.lng]);
    if (accommodation && routePts.length) {
      routePts.unshift([accommodation.lat, accommodation.lng]);
      routePts.push([accommodation.lat, accommodation.lng]);
    }
    const pts: [number, number][] = [...routePts];
    if (routePts.length > 1) {
      L.polyline(routePts, { color: '#16A085', weight: 3, opacity: 0.7, dashArray: '2 8' }).addTo(map);
    }

    stops.forEach((s) => {
      const sel = s.id === selectedId;
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:${sel ? 30 : 24}px;height:${sel ? 30 : 24}px;border-radius:50%;background:${s.color};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${s.index}</div>`,
        iconSize: [sel ? 30 : 24, sel ? 30 : 24],
        iconAnchor: [sel ? 15 : 12, sel ? 15 : 12],
      });
      const marker = L.marker([s.lat, s.lng], { icon, zIndexOffset: sel ? 1000 : 0 }).addTo(map);
      marker.on('click', () => onSelect?.(s.id));
      markersRef.current[s.id] = marker;
    });

    if (accommodation) {
      const icon = L.divIcon({
        className: '',
        html: `<div aria-label="Alojamiento" style="width:30px;height:30px;border-radius:10px;background:#344054;color:#fff;display:flex;align-items:center;justify-content:center;font:800 12px system-ui;border:2px solid #fff;box-shadow:0 2px 7px rgba(0,0,0,.25)">H</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      L.marker([accommodation.lat, accommodation.lng], { icon }).addTo(map);
    }

    if (pts.length) {
      map.fitBounds(L.latLngBounds(pts).pad(0.2));
    }
  }, [stops, accommodation, onSelect]);

  // selección: centrar
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const s = stops.find((x) => x.id === selectedId);
    if (s) map.panTo([s.lat, s.lng]);
  }, [selectedId, stops]);

  return <View ref={containerRef} style={{ height, borderRadius: 16, overflow: 'hidden' }} />;
}
