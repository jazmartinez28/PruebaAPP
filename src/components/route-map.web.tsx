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
      L.polyline(routePts, { color: '#FFFFFF', weight: 8, opacity: 0.92, lineCap: 'round', lineJoin: 'round' }).addTo(map);
      L.polyline(routePts, { color: '#16A085', weight: 4, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(map);
    }

    stops.forEach((s) => {
      const sel = s.id === selectedId;
      const icon = L.divIcon({
        className: '',
        html: `<div aria-label="Parada ${s.index}" style="width:${sel ? 42 : 34}px;height:${sel ? 42 : 34}px;border-radius:50%;background:${s.color};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;border:${sel ? 4 : 3}px solid #fff;box-shadow:0 3px 10px rgba(29,39,51,.28);transition:all .18s ease-out">${s.index}</div>`,
        iconSize: [sel ? 42 : 34, sel ? 42 : 34],
        iconAnchor: [sel ? 21 : 17, sel ? 21 : 17],
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
      map.fitBounds(L.latLngBounds(pts).pad(0.28), { paddingTopLeft: [28, 28], paddingBottomRight: [28, 88] });
    }
  }, [stops, accommodation, onSelect, selectedId]);

  // selección: centrar
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const s = stops.find((x) => x.id === selectedId);
    if (s) map.panTo([s.lat, s.lng]);
  }, [selectedId, stops]);

  return <View ref={containerRef} style={{ height, borderRadius: 16, overflow: 'hidden' }} />;
}
