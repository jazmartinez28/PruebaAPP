import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sheet } from '@/components/sheet';
import { Body, Button, Card, Chip, H2, Label } from '@/components/ui';
import { REMOTE_CONFIG } from '@/constants/config';
import { Radius, Spacing } from '@/constants/theme';
import { CATEGORY_LABEL, PRICE_LABEL } from '@/data/catalog';
import { cityById } from '@/data/cities';
import { placeById, placesByCity } from '@/data/places';
import { useTheme } from '@/hooks/use-theme';
import { fmtDate, fmtRange } from '@/lib/dates';
import { fmtDist, legBetween, minToHHMM } from '@/lib/geo';
import { tripStats } from '@/lib/generate';
import { getAlternatives, tripStatusOf, type AltFilter } from '@/lib/trip';
import { RouteMap, type MapStop } from '@/components/route-map';
import { useStore } from '@/store/useStore';
import type { Activity, Trip } from '@/types';

type Tab = 'resumen' | 'itinerario' | 'mapa' | 'lugares';
const STATUS_LABEL = { proximo: 'Próximo', encurso: 'En curso', finalizado: 'Finalizado' } as const;

export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useStore((s) => s.trips.find((t) => t.id === id));
  const t = useTheme();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('resumen');
  const [day, setDay] = useState(0);
  const [detailAct, setDetailAct] = useState<Activity | null>(null);
  const [replaceAct, setReplaceAct] = useState<Activity | null>(null);
  const [moveAct, setMoveAct] = useState<Activity | null>(null);
  const [addDay, setAddDay] = useState<number | null>(null);
  const [share, setShare] = useState(false);
  const [toast, setToast] = useState<{ msg: string; undo?: boolean } | null>(null);

  if (!trip) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.background, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Body muted>Este viaje ya no existe.</Body>
        <Button title="Volver" onPress={() => router.replace('/viajes')} size="md" />
      </SafeAreaView>
    );
  }

  const city = cityById(trip.cityId);
  const status = tripStatusOf(trip);
  const stats = tripStats(trip.days);

  const showToast = (msg: string, undo?: boolean) => {
    setToast({ msg, undo });
    setTimeout(() => setToast((cur) => (cur?.msg === msg ? null : cur)), 4000);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      {/* Cabecera */}
      <LinearGradient colors={city?.gradient ?? [t.primary, t.primaryStrong]} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerTop}>
            <IconCircle icon="chevron-back" onPress={() => router.canGoBack() ? router.back() : router.replace('/viajes')} />
            <IconCircle icon="share-social" onPress={() => setShare(true)} />
          </View>
          <View style={{ paddingHorizontal: Spacing.three, paddingBottom: Spacing.three }}>
            <Body style={{ fontSize: 40 }}>{city?.emoji}</Body>
            <Body style={styles.headerTitle}>{trip.cityName}</Body>
            <View style={styles.headerMeta}>
              <View style={styles.metaChip}>
                <Ionicons name="calendar" size={13} color="#fff" />
                <Body style={styles.metaText}>{fmtRange(trip.startDate, trip.endDate)}</Body>
              </View>
              <View style={styles.metaChip}>
                <Ionicons name="ellipse" size={8} color="#fff" />
                <Body style={styles.metaText}>{STATUS_LABEL[status]}</Body>
              </View>
              <View style={styles.metaChip}>
                <Ionicons name="location" size={13} color="#fff" />
                <Body style={styles.metaText}>{stats.activities} actividades</Body>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Pestañas internas */}
      <View style={[styles.tabs, { backgroundColor: t.surface, borderBottomColor: t.border }]}>
        {(['resumen', 'itinerario', 'mapa', 'lugares'] as Tab[]).map((k) => {
          const on = tab === k;
          return (
            <Pressable key={k} onPress={() => setTab(k)} style={styles.tab}>
              <Body style={{ color: on ? t.primary : t.textSecondary, fontWeight: on ? '800' : '600', fontSize: 14 }}>
                {k[0].toUpperCase() + k.slice(1)}
              </Body>
              {on && <View style={[styles.tabInd, { backgroundColor: t.primary }]} />}
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.three, gap: Spacing.three, paddingBottom: 120 }}>
        {tab === 'resumen' && <ResumenTab trip={trip} onOpenDay={(d) => { setDay(d); setTab('itinerario'); }} />}
        {tab === 'itinerario' && (
          <ItinerarioTab
            trip={trip}
            day={day}
            setDay={setDay}
            onActivity={setDetailAct}
            onAdd={(d) => setAddDay(d)}
          />
        )}
        {tab === 'mapa' && <MapaTab trip={trip} day={day} setDay={setDay} onActivity={setDetailAct} />}
        {tab === 'lugares' && <LugaresTab trip={trip} onActivity={setDetailAct} />}
      </ScrollView>

      {/* Toast / deshacer */}
      {toast && <ToastBar toast={toast} onUndo={() => { useStore.getState().undo(); setToast(null); }} onClose={() => setToast(null)} />}

      {/* Detalle de actividad */}
      <ActivityDetailSheet
        trip={trip}
        activity={detailAct}
        onClose={() => setDetailAct(null)}
        onReplace={(a) => { setDetailAct(null); setReplaceAct(a); }}
        onMove={(a) => { setDetailAct(null); setMoveAct(a); }}
        onToast={showToast}
      />

      {/* Reemplazar */}
      <ReplaceSheet
        trip={trip}
        activity={replaceAct}
        onClose={() => setReplaceAct(null)}
        onDone={() => { setReplaceAct(null); showToast('Actividad reemplazada', true); }}
      />

      {/* Mover de día */}
      <MoveSheet
        trip={trip}
        activity={moveAct}
        onClose={() => setMoveAct(null)}
        onDone={(dLabel) => { setMoveAct(null); showToast(`Actividad movida al ${dLabel}`, true); }}
      />

      {/* Agregar lugar */}
      <AddSheet
        trip={trip}
        dayIndex={addDay}
        onClose={() => setAddDay(null)}
        onDone={() => { setAddDay(null); showToast('Lugar agregado', true); }}
      />

      {/* Compartir */}
      <ShareSheet trip={trip} visible={share} onClose={() => setShare(false)} onToast={showToast} />
    </View>
  );
}

/* ============================= Resumen ============================= */

function ResumenTab({ trip, onOpenDay }: { trip: Trip; onOpenDay: (d: number) => void }) {
  const t = useTheme();
  const stats = tripStats(trip.days);

  // stats calculadas
  let totalMeters = 0;
  let bookings = 0;
  const allStops: MapStop[] = [];
  let idx = 0;
  trip.days.forEach((d, di) => {
    d.activities.forEach((a, ai) => {
      const p = placeById(a.placeId);
      if (!p) return;
      idx++;
      allStops.push({ id: a.id, lat: p.lat, lng: p.lng, name: p.name, index: idx, color: p.isMeal ? t.secondary : t.primary });
      if (p.needsBooking) bookings++;
      if (ai < d.activities.length - 1) {
        const np = placeById(d.activities[ai + 1].placeId);
        if (np) totalMeters += legBetween(p, np).meters;
      }
    });
  });

  const acc = trip.accommodation;

  return (
    <>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <RouteMap stops={allStops} accommodation={acc} height={220} />
      </Card>

      <View style={styles.statGrid}>
        <StatBox icon="today" label="Días" value={String(stats.days)} />
        <StatBox icon="flag" label="Actividades" value={String(stats.activities)} />
        <StatBox icon="git-network" label="Zonas" value={String(stats.zones)} />
        <StatBox icon="walk" label="Recorrido" value={fmtDist(totalMeters)} />
      </View>

      <View style={{ gap: Spacing.two }}>
        <H2>Zonas por día</H2>
        {trip.days.map((d, i) => (
          <Pressable key={i} onPress={() => onOpenDay(i)}>
            <Card style={styles.zoneRow}>
              <View style={[styles.dayBadge, { backgroundColor: t.primarySoft }]}>
                <Body style={{ color: t.primaryStrong, fontWeight: '800' }}>{i + 1}</Body>
              </View>
              <View style={{ flex: 1 }}>
                <Body style={{ fontWeight: '700' }}>{d.zone || 'Día libre'}</Body>
                <Body muted style={{ fontSize: 13 }}>
                  {fmtDate(d.date)} · {d.activities.length} actividades
                </Body>
              </View>
              <Ionicons name="chevron-forward" size={18} color={t.textSecondary} />
            </Card>
          </Pressable>
        ))}
      </View>

      {(bookings > 0 || !acc) && (
        <View style={{ gap: Spacing.two }}>
          <H2>Para tener en cuenta</H2>
          {bookings > 0 && (
            <Card style={[styles.alert, { borderColor: t.warning }]}>
              <Ionicons name="bookmark" size={20} color={t.warning} />
              <Body style={{ flex: 1 }}>
                {bookings} {bookings === 1 ? 'lugar requiere' : 'lugares requieren'} reserva anticipada.
              </Body>
            </Card>
          )}
          {!acc && (
            <Card style={[styles.alert, { borderColor: t.border }]}>
              <Ionicons name="bed" size={20} color={t.textSecondary} />
              <Body style={{ flex: 1 }}>Todavía no cargaste tu alojamiento. Lo podés agregar cuando lo tengas.</Body>
            </Card>
          )}
        </View>
      )}
    </>
  );
}

/* ============================ Itinerario ============================ */

function ItinerarioTab({
  trip,
  day,
  setDay,
  onActivity,
  onAdd,
}: {
  trip: Trip;
  day: number;
  setDay: (d: number) => void;
  onActivity: (a: Activity) => void;
  onAdd: (d: number) => void;
}) {
  const t = useTheme();
  const d = trip.days[day];

  return (
    <>
      <DaySelector trip={trip} day={day} setDay={setDay} />
      {!d || d.activities.length === 0 ? (
        <Card style={{ alignItems: 'center', gap: 8, paddingVertical: Spacing.five }}>
          <Ionicons name="cafe-outline" size={32} color={t.textSecondary} />
          <Body muted style={{ textAlign: 'center' }}>Día libre. Agregá lo que quieras hacer.</Body>
          <Button title="Agregar lugar" icon="add" size="md" variant="ghost" onPress={() => onAdd(day)} />
        </Card>
      ) : (
        <>
          <DayHeader day={d} index={day} />
          <View>
            {d.activities.map((a, i) => {
              const p = placeById(a.placeId);
              if (!p) return null;
              const next = d.activities[i + 1];
              const leg = next ? (() => { const np = placeById(next.placeId); return np ? legBetween(p, np) : null; })() : null;
              return (
                <View key={a.id}>
                  <TimelineActivity activity={a} onPress={() => onActivity(a)} />
                  {leg && (
                    <View style={styles.legRow}>
                      <View style={{ width: 52, alignItems: 'center' }}>
                        <View style={[styles.legLine, { backgroundColor: t.border }]} />
                      </View>
                      <View style={[styles.legPill, { backgroundColor: t.secondarySoft }]}>
                        <Ionicons name={leg.mode === 'walk' ? 'walk' : 'bus'} size={13} color={t.secondary} />
                        <Body style={{ fontSize: 12, color: t.secondary, fontWeight: '600' }}>{leg.label}</Body>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
          <Button title="Agregar lugar a este día" icon="add" variant="ghost" size="md" onPress={() => onAdd(day)} />
        </>
      )}
    </>
  );
}

function DayHeader({ day, index }: { day: Trip['days'][number]; index: number }) {
  const t = useTheme();
  const acts = day.activities;
  const startMin = acts[0]?.startMin ?? 0;
  const last = acts[acts.length - 1];
  const endMin = last ? last.startMin + last.durationMin : 0;
  let meters = 0;
  let travel = 0;
  acts.forEach((a, i) => {
    const p = placeById(a.placeId);
    const np = acts[i + 1] ? placeById(acts[i + 1].placeId) : null;
    if (p && np) { const l = legBetween(p, np); meters += l.meters; travel += l.minutes; }
  });
  return (
    <Card style={{ gap: 6 }}>
      <Label style={{ color: t.secondary }}>Día {index + 1} · {day.zone}</Label>
      <Body style={{ fontWeight: '800', fontSize: 18 }}>{fmtDate(day.date)}</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, marginTop: 4 }}>
        <MiniStat icon="time" text={`${minToHHMM(startMin)}–${minToHHMM(endMin)}`} />
        <MiniStat icon="walk" text={fmtDist(meters)} />
        <MiniStat icon="bus" text={`${travel} min traslados`} />
      </View>
    </Card>
  );
}

function TimelineActivity({ activity, onPress }: { activity: Activity; onPress: () => void }) {
  const t = useTheme();
  const p = placeById(activity.placeId);
  if (!p) return null;
  const color = p.isMeal ? t.secondary : t.primary;
  return (
    <Pressable onPress={onPress} style={styles.actRow}>
      <View style={{ width: 52, alignItems: 'flex-end', paddingTop: 2 }}>
        <Body style={{ fontSize: 13, fontWeight: '700', color: t.textSecondary }}>{minToHHMM(activity.startMin)}</Body>
      </View>
      <View style={[styles.actDot, { backgroundColor: color }]}>
        {activity.mustSee && <Ionicons name="star" size={10} color="#fff" />}
      </View>
      <Card style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Body style={{ fontWeight: '700', flex: 1 }}>{p.name}</Body>
          <Ionicons name="ellipsis-horizontal" size={18} color={t.textSecondary} />
        </View>
        <Body muted style={{ fontSize: 13 }}>
          {CATEGORY_LABEL[p.categories[0]]} · {activity.durationMin} min · {PRICE_LABEL(p.price)}
        </Body>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
          {p.needsBooking && <Tag color={t.warning} text="Reservar" />}
          {activity.note && <Tag color={t.warning} text="Verificar horario" />}
          {activity.mustSee && <Tag color={t.primary} text="Imprescindible" />}
        </View>
      </Card>
    </Pressable>
  );
}

/* ============================== Mapa ============================== */

function MapaTab({ trip, day, setDay, onActivity }: { trip: Trip; day: number; setDay: (d: number) => void; onActivity: (a: Activity) => void }) {
  const t = useTheme();
  const [sel, setSel] = useState<string | undefined>();
  const d = trip.days[day];
  const stops: MapStop[] = (d?.activities ?? []).map((a, i) => {
    const p = placeById(a.placeId)!;
    return { id: a.id, lat: p.lat, lng: p.lng, name: p.name, index: i + 1, color: p.isMeal ? t.secondary : t.primary };
  });

  return (
    <>
      <DaySelector trip={trip} day={day} setDay={(x) => { setDay(x); setSel(undefined); }} />
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <RouteMap stops={stops} accommodation={trip.accommodation} selectedId={sel} onSelect={setSel} height={300} />
      </Card>
      <View style={{ gap: Spacing.two }}>
        {(d?.activities ?? []).map((a, i) => {
          const p = placeById(a.placeId);
          if (!p) return null;
          const on = sel === a.id;
          return (
            <Pressable key={a.id} onPress={() => setSel(a.id)} onLongPress={() => onActivity(a)}>
              <Card style={[styles.mapCard, on && { borderColor: t.primary, borderWidth: 2 }]}>
                <View style={[styles.mapNum, { backgroundColor: p.isMeal ? t.secondary : t.primary }]}>
                  <Body style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{i + 1}</Body>
                </View>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: '700' }}>{p.name}</Body>
                  <Body muted style={{ fontSize: 12 }}>{minToHHMM(a.startMin)} · {CATEGORY_LABEL[p.categories[0]]}</Body>
                </View>
                <Pressable onPress={() => onActivity(a)} hitSlop={8}>
                  <Ionicons name="information-circle-outline" size={22} color={t.textSecondary} />
                </Pressable>
              </Card>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

/* ============================= Lugares ============================= */

function LugaresTab({ trip, onActivity }: { trip: Trip; onActivity: (a: Activity) => void }) {
  const t = useTheme();
  const included = trip.days.flatMap((d) => d.activities);
  const mustSee = included.filter((a) => a.mustSee);
  const saved = trip.savedIds.map((id) => placeById(id)).filter(Boolean);
  const removed = trip.removedIds.map((id) => placeById(id)).filter(Boolean);

  const Section = ({ title, count, children }: { title: string; count: number; children: React.ReactNode }) => (
    <View style={{ gap: Spacing.two }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <H2>{title}</H2>
        <View style={[styles.countPill, { backgroundColor: t.backgroundElement }]}>
          <Body style={{ fontSize: 12, color: t.textSecondary, fontWeight: '700' }}>{count}</Body>
        </View>
      </View>
      {children}
    </View>
  );

  return (
    <>
      <Section title="Incluidos" count={included.length}>
        {included.map((a) => {
          const p = placeById(a.placeId);
          if (!p) return null;
          return (
            <Pressable key={a.id} onPress={() => onActivity(a)}>
              <Card style={styles.placeRow}>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: '600' }}>{p.name}</Body>
                  <Body muted style={{ fontSize: 12 }}>{CATEGORY_LABEL[p.categories[0]]} · {p.zone}</Body>
                </View>
                {a.mustSee && <Ionicons name="star" size={16} color={t.warning} />}
                <Ionicons name="chevron-forward" size={16} color={t.textSecondary} />
              </Card>
            </Pressable>
          );
        })}
      </Section>

      {mustSee.length > 0 && (
        <Section title="Imprescindibles" count={mustSee.length}>
          {mustSee.map((a) => {
            const p = placeById(a.placeId);
            return p ? (
              <Card key={a.id} style={styles.placeRow}>
                <Ionicons name="star" size={16} color={t.warning} />
                <Body style={{ flex: 1, fontWeight: '600' }}>{p.name}</Body>
              </Card>
            ) : null;
          })}
        </Section>
      )}

      {removed.length > 0 && (
        <Section title="Descartados" count={removed.length}>
          {removed.map((p) => (
            <Card key={p!.id} style={styles.placeRow}>
              <Body style={{ flex: 1, color: t.textSecondary, textDecorationLine: 'line-through' }}>{p!.name}</Body>
            </Card>
          ))}
        </Section>
      )}
    </>
  );
}

/* =========================== Sub-sheets =========================== */

function ActivityDetailSheet({
  trip,
  activity,
  onClose,
  onReplace,
  onMove,
  onToast,
}: {
  trip: Trip;
  activity: Activity | null;
  onClose: () => void;
  onReplace: (a: Activity) => void;
  onMove: (a: Activity) => void;
  onToast: (m: string, undo?: boolean) => void;
}) {
  const t = useTheme();
  const removeActivity = useStore((s) => s.removeActivity);
  const toggleSaved = useStore((s) => s.toggleSaved);
  const p = activity ? placeById(activity.placeId) : null;
  const city = cityById(trip.cityId);
  if (!activity || !p) return <Sheet visible={false} onClose={onClose}>{null}</Sheet>;

  const saved = trip.savedIds.includes(p.id);
  const openMaps = () => {
    const url = Platform.select({
      default: `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`,
    });
    Linking.openURL(url!);
  };

  const Action = ({ icon, label, onPress, danger }: { icon: any; label: string; onPress: () => void; danger?: boolean }) => (
    <Pressable onPress={onPress} style={[styles.action, { borderColor: t.border }]}>
      <Ionicons name={icon} size={20} color={danger ? t.error : t.primary} />
      <Body style={{ fontSize: 12, fontWeight: '600', color: danger ? t.error : t.text, textAlign: 'center' }}>{label}</Body>
    </Pressable>
  );

  return (
    <Sheet visible={!!activity} onClose={onClose} title={p.name}>
      <LinearGradient colors={city?.gradient ?? [t.primary, t.primaryStrong]} style={styles.detailHero}>
        <Body style={{ fontSize: 40 }}>{city?.emoji}</Body>
      </LinearGradient>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.three, flexWrap: 'wrap' }}>
        <Tag color={t.primary} text={CATEGORY_LABEL[p.categories[0]]} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Ionicons name="star" size={14} color={t.warning} />
          <Body style={{ fontWeight: '700', fontSize: 13 }}>{p.rating.toFixed(1)}</Body>
        </View>
        <Body muted style={{ fontSize: 13 }}>· {PRICE_LABEL(p.price)}</Body>
      </View>

      <Body style={{ marginTop: Spacing.two }}>{p.desc}</Body>
      {p.reason && (
        <Card style={{ marginTop: Spacing.two, flexDirection: 'row', gap: 8, backgroundColor: t.primarySoft, borderColor: t.primarySoft }}>
          <Ionicons name="bulb" size={18} color={t.primaryStrong} />
          <Body style={{ flex: 1, fontSize: 13, color: t.primaryStrong }}>{p.reason}</Body>
        </Card>
      )}

      <View style={{ marginTop: Spacing.three, gap: 8 }}>
        <InfoLine icon="time" label="Horario" value={`${minToHHMM(activity.startMin)} · ${activity.durationMin} min`} />
        <InfoLine icon="location" label="Zona" value={p.zone} />
        {p.needsBooking && <InfoLine icon="bookmark" label="Reserva" value="Recomendada" warn />}
        {p.openFrom && <InfoLine icon="storefront" label="Abre" value={`${p.openFrom}–${p.openTo ?? ''}`} />}
        {(p.confident === false || activity.note) && (
          <InfoLine icon="alert-circle" label="Aviso" value={activity.note ?? 'Horario/precio sujeto a cambios. Verificá en el sitio oficial.'} warn />
        )}
      </View>

      <View style={styles.actionGrid}>
        <Action icon="swap-horizontal" label="Reemplazar" onPress={() => onReplace(activity)} />
        <Action icon="calendar" label="Mover de día" onPress={() => onMove(activity)} />
        <Action icon={saved ? 'bookmark' : 'bookmark-outline'} label={saved ? 'Guardado' : 'Guardar'} onPress={() => { toggleSaved(trip.id, p.id); onToast(saved ? 'Quitado de guardados' : 'Lugar guardado'); }} />
        <Action icon="map" label="Abrir en Maps" onPress={openMaps} />
        <Action icon="trash" label="Eliminar" danger onPress={() => { removeActivity(trip.id, activity.id); onClose(); onToast('Actividad eliminada', true); }} />
      </View>

      <Body muted style={{ fontSize: 11, marginTop: Spacing.three, textAlign: 'center' }}>
        Fuente: datos de ejemplo · Actualizado recientemente
      </Body>
    </Sheet>
  );
}

function ReplaceSheet({ trip, activity, onClose, onDone }: { trip: Trip; activity: Activity | null; onClose: () => void; onDone: () => void }) {
  const t = useTheme();
  const replaceActivity = useStore((s) => s.replaceActivity);
  const plan = useStore((s) => s.user?.plan);
  const [filter, setFilter] = useState<AltFilter>('cercano');
  const limit = plan === 'premium' ? REMOTE_CONFIG.premiumAlternatives : REMOTE_CONFIG.freeAlternatives;
  const alts = activity ? getAlternatives(trip, activity, filter, limit) : [];

  const FILTERS: { id: AltFilter; label: string }[] = [
    { id: 'cercano', label: 'Más cerca' },
    { id: 'gratis', label: 'Gratis' },
    { id: 'cultural', label: 'Cultural' },
    { id: 'gastronomia', label: 'Gastronomía' },
    { id: 'tranquilo', label: 'Más corto' },
  ];

  return (
    <Sheet visible={!!activity} onClose={onClose} title="Reemplazar por…">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: Spacing.two }}>
        {FILTERS.map((f) => (
          <Chip key={f.id} label={f.label} selected={filter === f.id} onPress={() => setFilter(f.id)} />
        ))}
      </ScrollView>
      {alts.length === 0 && <Body muted style={{ paddingVertical: Spacing.three, textAlign: 'center' }}>No hay más alternativas con este filtro.</Body>}
      {alts.map(({ place, dist }) => (
        <Pressable
          key={place.id}
          onPress={() => { if (activity) replaceActivity(trip.id, activity.id, place.id); onDone(); }}>
          <Card style={styles.altRow}>
            <View style={{ flex: 1 }}>
              <Body style={{ fontWeight: '700' }}>{place.name}</Body>
              <Body muted style={{ fontSize: 12 }}>
                {CATEGORY_LABEL[place.categories[0]]} · {fmtDist(dist)} · {place.durationMin} min · {PRICE_LABEL(place.price)}
              </Body>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="star" size={13} color={t.warning} />
              <Body style={{ fontWeight: '700', fontSize: 13 }}>{place.rating.toFixed(1)}</Body>
            </View>
          </Card>
        </Pressable>
      ))}
      {plan !== 'premium' && (
        <Body muted style={{ fontSize: 12, textAlign: 'center', marginTop: Spacing.two }}>
          Plan gratis: {REMOTE_CONFIG.freeAlternatives} alternativas. Premium te da muchas más.
        </Body>
      )}
    </Sheet>
  );
}

function MoveSheet({ trip, activity, onClose, onDone }: { trip: Trip; activity: Activity | null; onClose: () => void; onDone: (label: string) => void }) {
  const t = useTheme();
  const move = useStore((s) => s.moveActivityToDay);
  const currentDay = trip.days.findIndex((d) => d.activities.some((a) => a.id === activity?.id));

  return (
    <Sheet visible={!!activity} onClose={onClose} title="Mover a otro día">
      {trip.days.map((d, i) => (
        <Pressable
          key={i}
          disabled={i === currentDay}
          onPress={() => { if (activity) move(trip.id, activity.id, i); onDone(`Día ${i + 1}`); }}>
          <Card style={[styles.altRow, i === currentDay && { opacity: 0.4 }]}>
            <View style={[styles.dayBadge, { backgroundColor: t.primarySoft }]}>
              <Body style={{ color: t.primaryStrong, fontWeight: '800' }}>{i + 1}</Body>
            </View>
            <View style={{ flex: 1 }}>
              <Body style={{ fontWeight: '700' }}>Día {i + 1} · {d.zone || 'libre'}</Body>
              <Body muted style={{ fontSize: 12 }}>{fmtDate(d.date)} · {d.activities.length} act.</Body>
            </View>
            {i === currentDay ? <Body muted style={{ fontSize: 12 }}>actual</Body> : <Ionicons name="arrow-forward" size={18} color={t.primary} />}
          </Card>
        </Pressable>
      ))}
    </Sheet>
  );
}

function AddSheet({ trip, dayIndex, onClose, onDone }: { trip: Trip; dayIndex: number | null; onClose: () => void; onDone: () => void }) {
  const t = useTheme();
  const add = useStore((s) => s.addActivity);
  const usedIds = new Set(trip.days.flatMap((d) => d.activities.map((a) => a.placeId)));
  const available = placesByCity(trip.cityId).filter((p) => !usedIds.has(p.id));

  return (
    <Sheet visible={dayIndex !== null} onClose={onClose} title={`Agregar al Día ${(dayIndex ?? 0) + 1}`}>
      {available.map((p) => (
        <Pressable key={p.id} onPress={() => { if (dayIndex !== null) add(trip.id, dayIndex, p.id); onDone(); }}>
          <Card style={styles.altRow}>
            <View style={{ flex: 1 }}>
              <Body style={{ fontWeight: '700' }}>{p.name}</Body>
              <Body muted style={{ fontSize: 12 }}>{CATEGORY_LABEL[p.categories[0]]} · {p.zone} · {PRICE_LABEL(p.price)}</Body>
            </View>
            <Ionicons name="add-circle" size={24} color={t.primary} />
          </Card>
        </Pressable>
      ))}
      {available.length === 0 && <Body muted style={{ textAlign: 'center', paddingVertical: Spacing.three }}>Ya incluiste todos los lugares disponibles.</Body>}
    </Sheet>
  );
}

function ShareSheet({ trip, visible, onClose, onToast }: { trip: Trip; visible: boolean; onClose: () => void; onToast: (m: string) => void }) {
  const t = useTheme();
  const text = `Mirá mi viaje a ${trip.cityName} (${fmtRange(trip.startDate, trip.endDate)}) armado con Rumbo ✈️`;
  const opts = [
    { icon: 'logo-whatsapp', label: 'WhatsApp', onPress: () => { Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`); onClose(); } },
    {
      icon: 'link', label: 'Copiar enlace', onPress: async () => {
        try { if (typeof navigator !== 'undefined' && navigator.clipboard) await navigator.clipboard.writeText(text); } catch {}
        onClose(); onToast('Enlace copiado');
      },
    },
    { icon: 'eye', label: 'Solo lectura', onPress: () => { onClose(); onToast('Enlace de solo lectura creado'); } },
  ];
  return (
    <Sheet visible={visible} onClose={onClose} title="Compartir viaje">
      {opts.map((o) => (
        <Pressable key={o.label} onPress={o.onPress}>
          <Card style={styles.altRow}>
            <Ionicons name={o.icon as any} size={22} color={t.primary} />
            <Body style={{ flex: 1, fontWeight: '600' }}>{o.label}</Body>
          </Card>
        </Pressable>
      ))}
    </Sheet>
  );
}

/* ============================ Pequeños ============================ */

function DaySelector({ trip, day, setDay }: { trip: Trip; day: number; setDay: (d: number) => void }) {
  const t = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {trip.days.map((d, i) => {
        const on = i === day;
        return (
          <Pressable key={i} onPress={() => setDay(i)} style={[styles.dayPill, { backgroundColor: on ? t.primary : t.surface, borderColor: on ? t.primary : t.border }]}>
            <Body style={{ color: on ? '#fff' : t.text, fontWeight: '700', fontSize: 13 }}>Día {i + 1}</Body>
            <Body style={{ color: on ? 'rgba(255,255,255,0.85)' : t.textSecondary, fontSize: 11 }}>{fmtDate(d.date).split(' ').slice(1).join(' ')}</Body>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function IconCircle({ icon, onPress }: { icon: any; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.headerIcon}>
      <Ionicons name={icon} size={20} color="#fff" />
    </Pressable>
  );
}

function StatBox({ icon, label, value }: { icon: any; label: string; value: string }) {
  const t = useTheme();
  return (
    <Card style={styles.statBox}>
      <Ionicons name={icon} size={18} color={t.primary} />
      <Body style={{ fontWeight: '800', fontSize: 16 }}>{value}</Body>
      <Body muted style={{ fontSize: 11 }}>{label}</Body>
    </Card>
  );
}

function MiniStat({ icon, text }: { icon: any; text: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name={icon} size={14} color={t.textSecondary} />
      <Body muted style={{ fontSize: 13 }}>{text}</Body>
    </View>
  );
}

function InfoLine({ icon, label, value, warn }: { icon: any; label: string; value: string; warn?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <Ionicons name={icon} size={17} color={warn ? t.warning : t.textSecondary} style={{ marginTop: 1 }} />
      <Body style={{ width: 68, fontSize: 13, color: t.textSecondary }}>{label}</Body>
      <Body style={{ flex: 1, fontSize: 13, fontWeight: '500', color: warn ? t.warning : t.text }}>{value}</Body>
    </View>
  );
}

function Tag({ color, text }: { color: string; text: string }) {
  return (
    <View style={{ backgroundColor: color + '22', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill }}>
      <Body style={{ fontSize: 11, fontWeight: '700', color }}>{text}</Body>
    </View>
  );
}

function ToastBar({ toast, onUndo, onClose }: { toast: { msg: string; undo?: boolean }; onUndo: () => void; onClose: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.toast, { backgroundColor: t.text, bottom: insets.bottom + 16 }]}>
      <Ionicons name="checkmark-circle" size={18} color="#fff" />
      <Body style={{ color: t.background, flex: 1, fontSize: 13, fontWeight: '600' }}>{toast.msg}</Body>
      {toast.undo && (
        <Pressable onPress={onUndo} hitSlop={8}>
          <Body style={{ color: '#FF9E86', fontWeight: '800', fontSize: 13 }}>Deshacer</Body>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingBottom: 4 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.three, paddingTop: Spacing.one },
  headerIcon: { width: 38, height: 38, borderRadius: Radius.pill, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 2 },
  headerMeta: { flexDirection: 'row', gap: 8, marginTop: Spacing.two, flexWrap: 'wrap' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill },
  metaText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabInd: { position: 'absolute', bottom: 0, height: 3, width: 28, borderRadius: 2 },
  statGrid: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  statBox: { flexGrow: 1, flexBasis: '22%', alignItems: 'center', gap: 3, paddingVertical: Spacing.three },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  dayBadge: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  alert: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: 1.5 },
  actRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  actDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  legRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  legLine: { width: 2, height: 22 },
  legPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill },
  mapCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  mapNum: { width: 30, height: 30, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  countPill: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: Radius.pill },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  detailHero: { height: 120, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.one },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.four },
  action: { width: '31%', flexGrow: 1, alignItems: 'center', gap: 6, paddingVertical: Spacing.three, borderWidth: 1, borderRadius: Radius.md },
  altRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dayPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.md, borderWidth: 1.5, alignItems: 'center' },
  toast: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderRadius: Radius.md },
});
