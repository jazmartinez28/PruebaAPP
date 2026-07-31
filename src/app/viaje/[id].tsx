import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Share, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CityImage } from '@/components/city-image';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PackingList } from '@/components/packing-list';
import { PlaceImage } from '@/components/place-image';
import { Sheet } from '@/components/sheet';
import { AccommodationSheet, TicketEditorSheet, TransportSheet } from '@/components/trip-tools';
import { Body, Button, Card, Chip, H2, Label } from '@/components/ui';
import { REMOTE_CONFIG } from '@/constants/config';
import { Radius, Spacing } from '@/constants/theme';
import { CATEGORY_LABEL, PRICE_LABEL } from '@/data/catalog';
import { cityById } from '@/data/cities';
import { placeById, placesByCity } from '@/data/places';
import { useTheme } from '@/hooks/use-theme';
import { purchaseUrlFor } from '@/lib/commerce';
import { CATEGORY_VISUAL, categoryVisualFor } from '@/lib/category-style';
import { fmtDate, fmtRange } from '@/lib/dates';
import { fmtDist, legBetween, minToHHMM } from '@/lib/geo';
import { tripStats } from '@/lib/generate';
import { recommendedTransport } from '@/lib/transport';
import { ticketInfo } from '@/lib/tickets';
import { getAlternatives, tripStatusOf, type AltFilter } from '@/lib/trip';
import { exportTripCalendar, shareCalendarFile, shareTripPdf, type ExportDetail } from '@/lib/trip-export';
import { RouteMap, type MapStop } from '@/components/route-map';
import { useStore } from '@/store/useStore';
import type { Activity, Place, Trip } from '@/types';

type Tab = 'resumen' | 'itinerario' | 'mapa' | 'valija' | 'tickets' | 'lugares';
const STATUS_LABEL = { proximo: 'Próximo', encurso: 'En curso', finalizado: 'Finalizado' } as const;
const TAB_LABEL: Record<Tab, string> = {
  resumen: 'Resumen',
  itinerario: 'Plan',
  mapa: 'Mapa',
  valija: 'Valija',
  tickets: 'Tickets',
  lugares: 'Lugares',
};
const PRIMARY_TABS = [
  { id: 'resumen', label: 'Resumen', icon: 'grid-outline' },
  { id: 'itinerario', label: 'Plan', icon: 'list-outline' },
  { id: 'mapa', label: 'Mapa', icon: 'map-outline' },
  { id: 'more', label: 'Más', icon: 'ellipsis-horizontal-circle-outline' },
] as const;

export default function TripScreen() {
  const { id, tab: initialTab, action } = useLocalSearchParams<{
    id: string;
    tab?: string;
    action?: string;
  }>();
  const trip = useStore((s) => s.trips.find((t) => t.id === id));
  const t = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [tab, setTab] = useState<Tab>(
    initialTab && initialTab in TAB_LABEL ? (initialTab as Tab) : 'resumen',
  );
  const [day, setDay] = useState(0);
  const [detailAct, setDetailAct] = useState<Activity | null>(null);
  const [replaceAct, setReplaceAct] = useState<Activity | null>(null);
  const [moveAct, setMoveAct] = useState<Activity | null>(null);
  const [addDay, setAddDay] = useState<number | null>(null);
  const [share, setShare] = useState(action === 'share');
  const [transportLeg, setTransportLeg] = useState<{ from: Place; to: Place } | null>(null);
  const [ticketActivity, setTicketActivity] = useState<Activity | null>(null);
  const [editActivity, setEditActivity] = useState<Activity | null>(null);
  const [editDayStart, setEditDayStart] = useState<number | null>(null);
  const [editHotel, setEditHotel] = useState(action === 'hotel');
  const [pendingDeleteAct, setPendingDeleteAct] = useState<Activity | null>(null);
  const [confirmTripDelete, setConfirmTripDelete] = useState(false);
  const [toast, setToast] = useState<{ msg: string; undo?: boolean } | null>(null);
  const removeActivity = useStore((s) => s.removeActivity);
  const deleteTrip = useStore((s) => s.deleteTrip);

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
      <CityImage city={city} scrim={0.4} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerTop}>
            <IconCircle icon="chevron-back" onPress={() => router.canGoBack() ? router.back() : router.replace('/viajes')} />
            <View style={{ flexDirection: 'row', gap: Spacing.two }}>
              <IconCircle icon="share-social" onPress={() => setShare(true)} />
              <IconCircle icon="trash-outline" onPress={() => setConfirmTripDelete(true)} />
            </View>
          </View>
          <View style={{ paddingHorizontal: Spacing.three, paddingBottom: Spacing.three }}>
            <Ionicons name="location-outline" size={34} color="#FFFFFF" />
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
      </CityImage>

      {/* Pestañas internas */}
      <ScrollView
        horizontal
        style={[styles.tabsViewport, { backgroundColor: t.surface, borderBottomColor: t.border }]}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContent}>
        {PRIMARY_TABS.map((item) => {
          const on = item.id === 'more'
            ? tab === 'valija' || tab === 'tickets' || tab === 'lugares'
            : tab === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setTab(item.id === 'more' ? 'valija' : item.id)}
              style={styles.tab}>
              <Ionicons name={item.icon} size={18} color={on ? t.primary : t.textSecondary} />
              <Body style={{ color: on ? t.primary : t.textSecondary, fontWeight: on ? '800' : '600', fontSize: 14 }}>
                {item.label}
              </Body>
              {on && <View style={[styles.tabInd, { backgroundColor: t.primary }]} />}
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.tripContent, { paddingHorizontal: width >= 760 ? Spacing.five : Spacing.three }]}>
        {tab === 'resumen' && (
          <ResumenTab
            trip={trip}
            onOpenDay={(d) => { setDay(d); setTab('itinerario'); }}
            onEditHotel={() => setEditHotel(true)}
            onOpenTickets={() => setTab('tickets')}
          />
        )}
        {tab === 'itinerario' && (
          <ItinerarioTab
            trip={trip}
            day={day}
            setDay={setDay}
            onActivity={setDetailAct}
            onAdd={(d) => setAddDay(d)}
            onTransport={(from, to) => setTransportLeg({ from, to })}
            onToast={showToast}
            onMap={() => setTab('mapa')}
            onEdit={setEditActivity}
            onEditDayStart={setEditDayStart}
          />
        )}
        {tab === 'mapa' && <MapaTab trip={trip} day={day} setDay={setDay} onActivity={setDetailAct} onPlan={() => setTab('itinerario')} />}
        {(tab === 'valija' || tab === 'tickets' || tab === 'lugares') && (
          <>
            <UtilitySwitcher value={tab} onChange={setTab} />
            {tab === 'valija' && <PackingList trip={trip} />}
            {tab === 'tickets' && <TicketsTab trip={trip} onOpenActivity={setDetailAct} />}
            {tab === 'lugares' && <LugaresTab trip={trip} onActivity={setDetailAct} />}
          </>
        )}
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
        onTicket={(a) => { setDetailAct(null); setTicketActivity(a); }}
        onRequestDelete={(a) => { setDetailAct(null); setPendingDeleteAct(a); }}
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
      <TransportSheet
        cityId={trip.cityId}
        leg={transportLeg}
        onClose={() => setTransportLeg(null)}
      />
      <TicketEditorSheet
        trip={trip}
        activity={ticketActivity}
        onClose={() => setTicketActivity(null)}
        onSaved={() => { setTicketActivity(null); setTab('tickets'); showToast('Ticket guardado'); }}
      />
      <AccommodationSheet
        trip={trip}
        visible={editHotel}
        onClose={() => setEditHotel(false)}
        onSaved={() => { setEditHotel(false); showToast('Alojamiento actualizado'); }}
      />
      <ActivityEditSheet
        trip={trip}
        activity={editActivity}
        onClose={() => setEditActivity(null)}
        onSaved={() => { setEditActivity(null); showToast('Actividad actualizada', true); }}
      />
      <DayStartSheet
        trip={trip}
        dayIndex={editDayStart}
        onClose={() => setEditDayStart(null)}
        onSaved={() => { setEditDayStart(null); showToast('Horario del día actualizado', true); }}
      />

      {/* Confirmación: eliminar actividad */}
      <ConfirmDialog
        visible={!!pendingDeleteAct}
        destructive
        icon="trash"
        title={
          pendingDeleteAct
            ? `¿Eliminar ${placeById(pendingDeleteAct.placeId)?.name ?? 'esta actividad'} del itinerario?`
            : ''
        }
        message={
          pendingDeleteAct
            ? `Esta actividad se quitará del Día ${
                trip.days.findIndex((d) => d.activities.some((a) => a.id === pendingDeleteAct.id)) + 1
              } y el recorrido podrá necesitar una reorganización. Vas a poder deshacerlo.`
            : undefined
        }
        confirmLabel="Eliminar"
        onCancel={() => setPendingDeleteAct(null)}
        onConfirm={() => {
          if (pendingDeleteAct) {
            removeActivity(trip.id, pendingDeleteAct.id);
            showToast('Actividad eliminada', true);
          }
          setPendingDeleteAct(null);
        }}
      />

      {/* Confirmación: eliminar viaje completo */}
      <ConfirmDialog
        visible={confirmTripDelete}
        destructive
        icon="trash"
        title="¿Eliminar este viaje?"
        message={`${trip.cityName} · ${fmtRange(trip.startDate, trip.endDate)}. Se eliminará el itinerario completo, los tickets y la valija. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar viaje"
        onCancel={() => setConfirmTripDelete(false)}
        onConfirm={() => {
          setConfirmTripDelete(false);
          deleteTrip(trip.id);
          router.replace('/viajes');
        }}
      />
    </View>
  );
}

function UtilitySwitcher({
  value,
  onChange,
}: {
  value: 'valija' | 'tickets' | 'lugares';
  onChange: (tab: Tab) => void;
}) {
  const t = useTheme();
  const options = [
    { id: 'valija', label: 'Valija', icon: 'bag-check-outline' },
    { id: 'tickets', label: 'Tickets', icon: 'ticket-outline' },
    { id: 'lugares', label: 'Lugares', icon: 'bookmark-outline' },
  ] as const;
  return (
    <View style={[styles.utilitySwitch, { backgroundColor: t.backgroundElement }]}>
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.id)}
            style={[styles.utilityButton, selected && { backgroundColor: t.surface }]}>
            <Ionicons name={option.icon} size={18} color={selected ? t.primary : t.textSecondary} />
            <Body style={{ fontSize: 12, fontWeight: '800', color: selected ? t.text : t.textSecondary }}>{option.label}</Body>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ============================= Resumen ============================= */

function ResumenTab({
  trip,
  onOpenDay,
  onEditHotel,
  onOpenTickets,
}: {
  trip: Trip;
  onOpenDay: (d: number) => void;
  onEditHotel: () => void;
  onOpenTickets: () => void;
}) {
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
      allStops.push({ id: a.id, lat: p.lat, lng: p.lng, name: p.name, index: idx, color: categoryVisualFor(p).color });
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

      <View style={styles.tripTools}>
        <Pressable onPress={onEditHotel} style={({ pressed }) => [styles.tripTool, pressed && { opacity: 0.75 }]}>
          <View style={[styles.tripToolIcon, { backgroundColor: t.secondarySoft }]}>
            <Ionicons name="bed-outline" size={21} color={t.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Body style={{ fontWeight: '800' }}>{acc ? 'Base del viaje' : 'Agregar alojamiento'}</Body>
            <Body muted numberOfLines={1} style={{ fontSize: 12 }}>
              {acc?.address ?? acc?.name ?? 'Mejora rutas y horarios de salida'}
            </Body>
          </View>
          <Ionicons name="chevron-forward" size={18} color={t.textSecondary} />
        </Pressable>
        <Pressable onPress={onOpenTickets} style={({ pressed }) => [styles.tripTool, pressed && { opacity: 0.75 }]}>
          <View style={[styles.tripToolIcon, { backgroundColor: t.primarySoft }]}>
            <Ionicons name="ticket-outline" size={21} color={t.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Body style={{ fontWeight: '800' }}>Tickets y reservas</Body>
            <Body muted style={{ fontSize: 12 }}>
              {(trip.tickets ?? []).length
                ? `${trip.tickets.length} guardados para este viaje`
                : 'Guardalos por actividad y encontralos rápido'}
            </Body>
          </View>
          <Ionicons name="chevron-forward" size={18} color={t.textSecondary} />
        </Pressable>
      </View>

      {(trip.arrivalTime != null || trip.departureTime != null) && (
        <Card style={styles.logisticsCard}>
          <View style={styles.logisticsHeading}>
            <View style={[styles.tripToolIcon, { backgroundColor: t.secondarySoft }]}>
              <Ionicons name="navigate-outline" size={20} color={t.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Body style={{ fontWeight: '900' }}>Llegada y salida protegidas</Body>
              <Body muted style={{ fontSize: 12 }}>El plan deja margen para equipaje y traslados.</Body>
            </View>
          </View>
          {trip.arrivalTime != null && (
            <InfoLine
              icon="log-in-outline"
              label="Llegada"
              value={`${minToHHMM(trip.arrivalTime)} · ${trip.arrivalPlace || 'Punto de llegada'} · ${trip.arrivalBufferMin ?? 45} min de margen`}
            />
          )}
          {trip.departureTime != null && (
            <InfoLine
              icon="log-out-outline"
              label="Salida"
              value={`${minToHHMM(trip.departureTime)} · ${trip.departurePlace || 'Punto de salida'} · llegar ${trip.departureLeadMin ?? 120} min antes`}
            />
          )}
        </Card>
      )}

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
  onTransport,
  onToast,
  onMap,
  onEdit,
  onEditDayStart,
}: {
  trip: Trip;
  day: number;
  setDay: (d: number) => void;
  onActivity: (a: Activity) => void;
  onAdd: (d: number) => void;
  onTransport: (from: Place, to: Place) => void;
  onToast: (message: string, undo?: boolean) => void;
  onMap: () => void;
  onEdit: (activity: Activity) => void;
  onEditDayStart: (dayIndex: number) => void;
}) {
  const t = useTheme();
  const moveWithinDay = useStore((s) => s.moveActivityWithinDay);
  const d = trip.days[day];
  const hotelPlace: Place | null = trip.accommodation
    ? {
        id: 'accommodation',
        cityId: trip.cityId,
        name: trip.accommodation.name,
        categories: ['local'],
        lat: trip.accommodation.lat,
        lng: trip.accommodation.lng,
        zone: trip.accommodation.zone ?? 'Alojamiento',
        durationMin: 0,
        price: 0,
        rating: 0,
        desc: trip.accommodation.address ?? 'Base del viaje',
        address: trip.accommodation.address,
      }
    : null;

  return (
    <>
      <DaySelector trip={trip} day={day} setDay={setDay} />
      <ViewModeSwitch mode="plan" onPlan={() => {}} onMap={onMap} />
      {!d || d.activities.length === 0 ? (
        <Card style={{ alignItems: 'center', gap: 8, paddingVertical: Spacing.five }}>
          <Ionicons name="cafe-outline" size={32} color={t.textSecondary} />
          <Body muted style={{ textAlign: 'center' }}>Día libre. Agregá lo que quieras hacer.</Body>
          <Button title="Agregar lugar" icon="add" size="md" variant="ghost" onPress={() => onAdd(day)} />
        </Card>
      ) : (
        <>
          <DayHeader day={d} index={day} accommodation={trip.accommodation} onEditStart={() => onEditDayStart(day)} />
          <View>
            {day === 0 && trip.arrivalTime != null && (
              <TravelBoundaryTimelineRow
                icon="log-in-outline"
                title={`Llegada · ${minToHHMM(trip.arrivalTime)}`}
                detail={`${trip.arrivalPlace || 'Punto de llegada'} · ${(trip.arrivalBufferMin ?? 45) + (trip.arrivalTransferMin ?? 45)} min previstos antes de comenzar`}
              />
            )}
            {hotelPlace && d.activities[0] && (
              <>
                <AccommodationTimelineRow accommodation={trip.accommodation!} label="Salida desde tu alojamiento" />
                <TransportTimelineRow
                  cityId={trip.cityId}
                  from={hotelPlace}
                  to={placeById(d.activities[0].placeId)!}
                  onPress={() => onTransport(hotelPlace, placeById(d.activities[0].placeId)!)}
                />
              </>
            )}
            {d.activities.map((a, i) => {
              const p = placeById(a.placeId);
              if (!p) return null;
              const next = d.activities[i + 1];
              const leg = next ? (() => { const np = placeById(next.placeId); return np ? legBetween(p, np) : null; })() : null;
              return (
                <View key={a.id}>
                  <TimelineActivity
                    activity={a}
                    index={i}
                    total={d.activities.length}
                    ticketCount={(trip.tickets ?? []).filter((ticket) => ticket.activityId === a.id).length}
                    onPress={() => onActivity(a)}
                    onMove={(delta) => {
                      moveWithinDay(trip.id, a.id, delta);
                      onToast(`Actividad movida ${delta < 0 ? 'más temprano' : 'más tarde'}`, true);
                    }}
                    onEdit={() => onEdit(a)}
                  />
                  {leg && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Ver opciones para ir de ${p.name} a ${placeById(next.placeId)?.name ?? 'la próxima actividad'}`}
                      onPress={() => {
                        const nextPlace = placeById(next.placeId);
                        if (nextPlace) onTransport(p, nextPlace);
                      }}
                      style={({ pressed }) => [styles.legRow, pressed && { opacity: 0.72 }]}>
                      <View style={{ width: 52, alignItems: 'center' }}>
                        <View style={[styles.legLine, { backgroundColor: t.border }]} />
                      </View>
                      <View style={[styles.legPill, { backgroundColor: t.secondarySoft }]}>
                        <Ionicons
                          name={recommendedTransport(trip.cityId, p, placeById(next.placeId)!).icon}
                          size={14}
                          color={t.secondary}
                        />
                        <Body style={{ fontSize: 12, color: t.secondary, fontWeight: '700' }}>
                          {recommendedTransport(trip.cityId, p, placeById(next.placeId)!).label} · {leg.label}
                        </Body>
                        <Ionicons name="chevron-forward" size={13} color={t.secondary} />
                      </View>
                    </Pressable>
                  )}
                </View>
              );
            })}
            {hotelPlace && d.activities.length > 0 && (
              <>
                <TransportTimelineRow
                  cityId={trip.cityId}
                  from={placeById(d.activities[d.activities.length - 1].placeId)!}
                  to={hotelPlace}
                  onPress={() => onTransport(placeById(d.activities[d.activities.length - 1].placeId)!, hotelPlace)}
                />
                <AccommodationTimelineRow accommodation={trip.accommodation!} label="Regreso al alojamiento" />
              </>
            )}
            {day === trip.days.length - 1 && trip.departureTime != null && (
              <TravelBoundaryTimelineRow
                icon="log-out-outline"
                title={`Salida · ${minToHHMM(trip.departureTime)}`}
                detail={`${trip.departurePlace || 'Punto de salida'} · ${(trip.departureLeadMin ?? 120) + (trip.departureTransferMin ?? 45)} min protegidos al final del día`}
              />
            )}
          </View>
          <Button title="Agregar lugar a este día" icon="add" variant="ghost" size="md" onPress={() => onAdd(day)} />
        </>
      )}
    </>
  );
}

function TravelBoundaryTimelineRow({
  icon,
  title,
  detail,
}: {
  icon: 'log-in-outline' | 'log-out-outline';
  title: string;
  detail: string;
}) {
  const t = useTheme();
  return (
    <View style={styles.actRow}>
      <View style={{ width: 52 }} />
      <View style={[styles.actDot, { backgroundColor: t.textSecondary }]}>
        <Ionicons name={icon} size={12} color="#fff" />
      </View>
      <View style={[styles.boundaryTimeline, { backgroundColor: t.backgroundElement, borderColor: t.border }]}>
        <Ionicons name={icon} size={20} color={t.textSecondary} />
        <View style={{ flex: 1 }}>
          <Body style={{ fontWeight: '900' }}>{title}</Body>
          <Body muted style={{ fontSize: 12 }}>{detail}</Body>
        </View>
      </View>
    </View>
  );
}

function AccommodationTimelineRow({
  accommodation,
  label,
}: {
  accommodation: NonNullable<Trip['accommodation']>;
  label: string;
}) {
  const meta = CATEGORY_VISUAL.alojamiento;
  return (
    <View style={styles.actRow}>
      <View style={{ width: 52 }} />
      <View style={[styles.actDot, { backgroundColor: meta.color }]}>
        <Ionicons name={meta.icon} size={12} color="#fff" />
      </View>
      <View style={[styles.hotelTimeline, { backgroundColor: meta.soft }]}>
        <Ionicons name={meta.icon} size={20} color={meta.color} />
        <View style={{ flex: 1 }}>
          <Body style={{ color: meta.color, fontWeight: '900' }}>{label}</Body>
          <Body numberOfLines={1} style={{ color: meta.color, fontSize: 12 }}>
            {accommodation.name} · {accommodation.address ?? accommodation.zone ?? 'Base del viaje'}
          </Body>
        </View>
      </View>
    </View>
  );
}

function TransportTimelineRow({
  cityId,
  from,
  to,
  onPress,
}: {
  cityId: string;
  from: Place;
  to: Place;
  onPress: () => void;
}) {
  const meta = CATEGORY_VISUAL.traslado;
  const leg = legBetween(from, to);
  const transport = recommendedTransport(cityId, from, to);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ver traslado de ${from.name} a ${to.name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.legRow, pressed && { opacity: 0.72 }]}>
      <View style={{ width: 52, alignItems: 'center' }}><View style={[styles.legLine, { backgroundColor: meta.color }]} /></View>
      <View style={[styles.legPill, { backgroundColor: meta.soft }]}>
        <Ionicons name={transport.icon} size={14} color={meta.color} />
        <Body style={{ fontSize: 12, color: meta.color, fontWeight: '800' }}>{transport.label} · {leg.label}</Body>
        <Ionicons name="chevron-forward" size={13} color={meta.color} />
      </View>
    </Pressable>
  );
}

function DayHeader({
  day,
  index,
  accommodation,
  onEditStart,
}: {
  day: Trip['days'][number];
  index: number;
  accommodation: Trip['accommodation'];
  onEditStart: () => void;
}) {
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
  if (accommodation && acts.length) {
    const hotel = { lat: accommodation.lat, lng: accommodation.lng };
    const first = placeById(acts[0].placeId);
    const lastPlace = placeById(acts[acts.length - 1].placeId);
    if (first) {
      const leg = legBetween(hotel, first);
      meters += leg.meters;
      travel += leg.minutes;
    }
    if (lastPlace) {
      const leg = legBetween(lastPlace, hotel);
      meters += leg.meters;
      travel += leg.minutes;
    }
  }
  return (
    <Card style={{ gap: 6 }}>
      <View style={styles.dayHeadingRow}>
        <View style={{ flex: 1, gap: 3 }}>
          <Label style={{ color: t.secondary }}>Día {index + 1} · {day.zone}</Label>
          <Body style={{ fontWeight: '800', fontSize: 18 }}>{fmtDate(day.date)}</Body>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Cambiar hora de inicio del Día ${index + 1}`}
          onPress={onEditStart}
          style={({ pressed }) => [
            styles.dayStartButton,
            { backgroundColor: t.primarySoft, borderColor: t.primary + '44' },
            pressed && { opacity: 0.72 },
          ]}>
          <Ionicons name="time-outline" size={17} color={t.primary} />
          <Body style={{ color: t.primary, fontWeight: '900', fontSize: 12 }}>Cambiar inicio</Body>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, marginTop: 4 }}>
        <MiniStat icon="time" text={`${minToHHMM(startMin)}–${minToHHMM(endMin)}`} />
        <MiniStat icon="location" text={`${acts.length} actividades`} />
        <MiniStat icon="walk" text={fmtDist(meters)} />
        <MiniStat icon="bus" text={`${travel} min traslados`} />
      </View>
    </Card>
  );
}

function DayStartSheet({
  trip,
  dayIndex,
  onClose,
  onSaved,
}: {
  trip: Trip;
  dayIndex: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTheme();
  const setDayStart = useStore((s) => s.setDayStart);
  const [time, setTime] = useState('09:00');
  const [error, setError] = useState<string | null>(null);
  const selectedDay = dayIndex === null ? undefined : trip.days[dayIndex];

  useEffect(() => {
    if (!selectedDay) return;
    setTime(minToHHMM(selectedDay.startMin ?? selectedDay.activities[0]?.startMin ?? trip.dayStartMin ?? 540));
    setError(null);
  }, [selectedDay, trip.dayStartMin]);

  const save = () => {
    if (dayIndex === null) return;
    const match = time.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (!match) {
      setError('Ingresá una hora válida, por ejemplo 09:30.');
      return;
    }
    setDayStart(trip.id, dayIndex, Number(match[1]) * 60 + Number(match[2]));
    onSaved();
  };

  return (
    <Sheet visible={dayIndex !== null} onClose={onClose} title={`Hora de inicio · Día ${(dayIndex ?? 0) + 1}`}>
      <View style={{ gap: Spacing.three }}>
        <Body muted>
          Recalcularemos los horarios y traslados de este día sin cambiar el orden de tus actividades.
        </Body>
        <View style={styles.timePresets}>
          {['08:00', '09:00', '10:00', '11:00'].map((preset) => (
            <Chip key={preset} label={preset} selected={time === preset} onPress={() => { setTime(preset); setError(null); }} />
          ))}
        </View>
        <View style={{ gap: 6 }}>
          <Label>Hora personalizada</Label>
          <TextInput
            accessibilityLabel="Hora personalizada de inicio"
            value={time}
            onChangeText={(value) => { setTime(value); setError(null); }}
            placeholder="09:30"
            keyboardType="numbers-and-punctuation"
            placeholderTextColor={t.textSecondary}
            style={[styles.editInput, { color: t.text, borderColor: error ? t.error : t.border }]}
          />
          {error && <Body style={{ color: t.error, fontSize: 12 }}>{error}</Body>}
        </View>
        <Button title="Recalcular este día" icon="sparkles-outline" onPress={save} />
      </View>
    </Sheet>
  );
}

function TimelineActivity({
  activity,
  index,
  total,
  ticketCount,
  onPress,
  onMove,
  onEdit,
}: {
  activity: Activity;
  index: number;
  total: number;
  ticketCount: number;
  onPress: () => void;
  onMove: (delta: -1 | 1) => void;
  onEdit: () => void;
}) {
  const t = useTheme();
  const p = placeById(activity.placeId);
  if (!p) return null;
  const visual = categoryVisualFor(p);
  const color = visual.color;
  const statusLabel = activity.status === 'hecho' ? 'Completada' : activity.status === 'saltado' ? 'Cancelada' : activity.status === 'reservado' ? 'Reservada' : 'Pendiente';
  return (
    <View style={styles.actRow}>
      <View style={{ width: 52, alignItems: 'flex-end', paddingTop: 2 }}>
        <Body style={{ fontSize: 13, fontWeight: '700', color: t.textSecondary }}>{minToHHMM(activity.startMin)}</Body>
      </View>
      <View style={[styles.actDot, { backgroundColor: color }]}>
        <Ionicons name={activity.mustSee ? 'star' : visual.icon} size={11} color="#fff" />
      </View>
      <Pressable onPress={onPress} style={{ flex: 1 }}>
      <Card style={{ gap: 7 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <PlaceImage place={p} compact style={styles.activityThumb} />
          <Body style={{ fontWeight: '700', flex: 1 }}>{p.name}</Body>
          <View style={styles.reorderActions}>
            <Pressable
              disabled={index === 0}
              accessibilityLabel={`Mover ${p.name} más temprano`}
              hitSlop={6}
              onPress={(event) => { event.stopPropagation(); onMove(-1); }}
              style={[styles.reorderButton, index === 0 && { opacity: 0.25 }]}>
              <Ionicons name="chevron-up" size={17} color={t.textSecondary} />
            </Pressable>
            <Pressable
              disabled={index === total - 1}
              accessibilityLabel={`Mover ${p.name} más tarde`}
              hitSlop={6}
              onPress={(event) => { event.stopPropagation(); onMove(1); }}
              style={[styles.reorderButton, index === total - 1 && { opacity: 0.25 }]}>
              <Ionicons name="chevron-down" size={17} color={t.textSecondary} />
            </Pressable>
          </View>
        </View>
        <View style={styles.activityMeta}>
          <View style={[styles.categoryBadge, { backgroundColor: visual.soft }]}>
            <Ionicons name={visual.icon} size={14} color={visual.color} />
            <Body style={{ color: visual.color, fontSize: 11, fontWeight: '900' }}>{visual.label}</Body>
          </View>
          <Body muted style={{ fontSize: 12 }}>{activity.durationMin} min · {PRICE_LABEL(p.price)}</Body>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
          {(() => {
            const ti = ticketInfo(p);
            if (ti.status === 'none' || ti.status === 'free') return null;
            const color = ti.status === 'required' ? t.error : ti.reservation ? t.warning : t.primary;
            return <Tag color={color} text={ti.label} />;
          })()}
          {activity.note && <Tag color={t.warning} text="Verificar horario" />}
          {activity.mustSee && <Tag color={t.primary} text="Imprescindible" />}
          {ticketCount > 0 && <Tag color={t.secondary} text={`${ticketCount} ticket${ticketCount > 1 ? 's' : ''}`} />}
          <Tag color={activity.status === 'hecho' ? t.secondary : activity.status === 'saltado' ? t.error : t.textSecondary} text={statusLabel} />
        </View>
        <View style={[styles.quickActions, { borderTopColor: t.border }]}>
          <QuickActivityAction icon="create-outline" label="Editar" onPress={onEdit} />
          <QuickActivityAction icon="options-outline" label="Más opciones" onPress={onPress} />
        </View>
      </Card>
      </Pressable>
    </View>
  );
}

function QuickActivityAction({ icon, label, onPress, danger }: { icon: any; label: string; onPress: () => void; danger?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={(event) => { event.stopPropagation(); onPress(); }}
      style={({ pressed }) => [styles.quickAction, pressed && { opacity: 0.55 }]}>
      <Ionicons name={icon} size={16} color={danger ? t.error : t.textSecondary} />
      <Body style={{ fontSize: 10, fontWeight: '800', color: danger ? t.error : t.textSecondary }}>{label}</Body>
    </Pressable>
  );
}

/* ============================== Mapa ============================== */

function MapaTab({ trip, day, setDay, onActivity, onPlan }: { trip: Trip; day: number; setDay: (d: number) => void; onActivity: (a: Activity) => void; onPlan: () => void }) {
  const t = useTheme();
  const [sel, setSel] = useState<string | undefined>();
  const d = trip.days[day];
  const stops: MapStop[] = (d?.activities ?? []).map((a, i) => {
    const p = placeById(a.placeId)!;
    return { id: a.id, lat: p.lat, lng: p.lng, name: p.name, index: i + 1, color: categoryVisualFor(p).color };
  });

  return (
    <>
      <DaySelector trip={trip} day={day} setDay={(x) => { setDay(x); setSel(undefined); }} />
      <ViewModeSwitch mode="map" onPlan={onPlan} onMap={() => {}} />
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
                <View style={[styles.mapNum, { backgroundColor: categoryVisualFor(p).color }]}>
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

function ViewModeSwitch({ mode, onPlan, onMap }: { mode: 'plan' | 'map'; onPlan: () => void; onMap: () => void }) {
  const t = useTheme();
  return (
    <View style={[styles.viewSwitch, { backgroundColor: t.backgroundElement }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: mode === 'plan' }}
        onPress={onPlan}
        style={[styles.viewSwitchButton, mode === 'plan' && { backgroundColor: t.surface }]}>
        <Ionicons name="list-outline" size={17} color={mode === 'plan' ? t.primary : t.textSecondary} />
        <Body style={{ fontWeight: '800', fontSize: 12, color: mode === 'plan' ? t.primary : t.textSecondary }}>Itinerario</Body>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: mode === 'map' }}
        onPress={onMap}
        style={[styles.viewSwitchButton, mode === 'map' && { backgroundColor: t.surface }]}>
        <Ionicons name="map-outline" size={17} color={mode === 'map' ? t.secondary : t.textSecondary} />
        <Body style={{ fontWeight: '800', fontSize: 12, color: mode === 'map' ? t.secondary : t.textSecondary }}>Mapa</Body>
      </Pressable>
    </View>
  );
}

/* ============================= Tickets ============================= */

function TicketsTab({
  trip,
  onOpenActivity,
}: {
  trip: Trip;
  onOpenActivity: (activity: Activity) => void;
}) {
  const t = useTheme();
  const removeTicket = useStore((s) => s.removeTicket);
  const tickets = trip.tickets ?? [];
  const allActs = trip.days.flatMap((day) => day.activities);
  const needTicket = allActs.filter((a) => {
    const p = placeById(a.placeId);
    return p ? ticketInfo(p).ticket && !tickets.some((ticket) => ticket.activityId === a.id) : false;
  });
  const needReservation = allActs.filter((a) => {
    const p = placeById(a.placeId);
    return p ? ticketInfo(p).reservation && !tickets.some((ticket) => ticket.activityId === a.id) : false;
  });
  const noTicketCount = allActs.filter((a) => {
    const p = placeById(a.placeId);
    if (!p) return false;
    const info = ticketInfo(p);
    return !info.ticket && !info.reservation;
  }).length;

  return (
    <>
      <View>
        <H2>Tu billetera de viaje</H2>
        <Body muted style={{ marginTop: 4 }}>
          Entradas, confirmaciones y accesos ordenados por actividad.
        </Body>
      </View>

      {tickets.length === 0 ? (
        <View style={[styles.ticketEmpty, { backgroundColor: t.secondarySoft }]}>
          <View style={[styles.ticketEmptyIcon, { backgroundColor: t.secondary }]}>
            <Ionicons name="ticket-outline" size={28} color="#fff" />
          </View>
          <Body style={{ color: t.secondary, fontWeight: '900', fontSize: 18 }}>
            Todavía no guardaste tickets
          </Body>
          <Body style={{ color: t.secondary, textAlign: 'center', fontSize: 13 }}>
            Abrí una actividad paga, comprá en el sitio oficial y guardá acá el enlace o código de confirmación.
          </Body>
        </View>
      ) : (
        <View style={{ gap: Spacing.two }}>
          {tickets
            .slice()
            .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
            .map((ticket) => {
              const place = placeById(ticket.placeId);
              return (
                <View key={ticket.id} style={[styles.ticketCard, { backgroundColor: t.surface }]}>
                  <View style={[styles.ticketStripe, { backgroundColor: t.primary }]} />
                  <View style={styles.ticketBody}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                      <View style={[styles.ticketGlyph, { backgroundColor: t.primarySoft }]}>
                        <Ionicons name="ticket" size={21} color={t.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Body style={{ fontWeight: '900', fontSize: 16 }}>{ticket.title}</Body>
                        <Body muted style={{ fontSize: 12 }}>
                          {ticket.date ? fmtDate(ticket.date) : place?.zone ?? trip.cityName}
                        </Body>
                      </View>
                      <Pressable
                        accessibilityLabel={`Eliminar ticket de ${ticket.title}`}
                        hitSlop={8}
                        onPress={() => removeTicket(trip.id, ticket.id)}>
                        <Ionicons name="trash-outline" size={19} color={t.textSecondary} />
                      </Pressable>
                    </View>
                    {ticket.confirmationCode && (
                      <View style={[styles.codeBox, { backgroundColor: t.background }]}>
                        <Label>Código de confirmación</Label>
                        <Body selectable style={{ fontWeight: '900', letterSpacing: 1 }}>
                          {ticket.confirmationCode}
                        </Body>
                      </View>
                    )}
                    <View style={styles.ticketActions}>
                      {ticket.ticketUrl && (
                        <Button
                          title="Abrir ticket"
                          icon="open-outline"
                          size="md"
                          onPress={() => Linking.openURL(ticket.ticketUrl!)}
                          style={{ flex: 1 }}
                        />
                      )}
                      {ticket.attachmentUri && (
                        <Button
                          title="Ver archivo"
                          icon="attach-outline"
                          size="md"
                          variant="ghost"
                          onPress={() => Linking.openURL(ticket.attachmentUri!)}
                          style={{ flex: 1 }}
                        />
                      )}
                      {ticket.activityId && (
                        <Button
                          title="Ver actividad"
                          icon="location-outline"
                          size="md"
                          variant="ghost"
                          onPress={() => {
                            const activity = trip.days
                              .flatMap((day) => day.activities)
                              .find((item) => item.id === ticket.activityId);
                            if (activity) onOpenActivity(activity);
                          }}
                          style={{ flex: 1 }}
                        />
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
        </View>
      )}

      {needTicket.length > 0 && (
        <View style={{ gap: Spacing.two }}>
          <H2>Tickets pendientes</H2>
          {needTicket.map((activity) => {
            const place = placeById(activity.placeId);
            const saved = tickets.some((ticket) => ticket.activityId === activity.id);
            if (!place) return null;
            const info = ticketInfo(place);
            return (
              <Pressable key={activity.id} onPress={() => onOpenActivity(activity)}>
                <Card style={styles.placeRow}>
                  <Ionicons name={saved ? 'checkmark-circle' : 'ticket-outline'} size={21} color={saved ? t.secondary : t.primary} />
                  <View style={{ flex: 1 }}>
                    <Body style={{ fontWeight: '700' }}>{place.name}</Body>
                    <Body muted style={{ fontSize: 12 }}>
                      {saved ? 'Ticket guardado' : `${info.label}${purchaseUrlFor(place) ? ' · compra oficial disponible' : ''}`}
                    </Body>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color={t.textSecondary} />
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}

      {needReservation.length > 0 && (
        <View style={{ gap: Spacing.two }}>
          <H2>Reservas pendientes</H2>
          {needReservation.map((activity) => {
            const place = placeById(activity.placeId);
            if (!place) return null;
            return (
              <Pressable key={activity.id} onPress={() => onOpenActivity(activity)}>
                <Card style={styles.placeRow}>
                  <Ionicons name="restaurant-outline" size={21} color={t.warning} />
                  <View style={{ flex: 1 }}>
                    <Body style={{ fontWeight: '700' }}>{place.name}</Body>
                    <Body muted style={{ fontSize: 12 }}>{ticketInfo(place).label}</Body>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color={t.textSecondary} />
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}

      {noTicketCount > 0 && (
        <View style={[styles.placeRow, { paddingHorizontal: Spacing.three }]}>
          <Ionicons name="checkmark-done-circle-outline" size={20} color={t.secondary} />
          <Body muted style={{ flex: 1, fontSize: 13 }}>
            {noTicketCount} {noTicketCount === 1 ? 'actividad no necesita' : 'actividades no necesitan'} ticket (plazas, paseos, entradas gratuitas).
          </Body>
        </View>
      )}
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
                <View style={[styles.placeCategoryIcon, { backgroundColor: categoryVisualFor(p).soft }]}>
                  <Ionicons name={categoryVisualFor(p).icon} size={18} color={categoryVisualFor(p).color} />
                </View>
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
  onTicket,
  onRequestDelete,
  onToast,
}: {
  trip: Trip;
  activity: Activity | null;
  onClose: () => void;
  onReplace: (a: Activity) => void;
  onMove: (a: Activity) => void;
  onTicket: (a: Activity) => void;
  onRequestDelete: (a: Activity) => void;
  onToast: (m: string, undo?: boolean) => void;
}) {
  const t = useTheme();
  const toggleSaved = useStore((s) => s.toggleSaved);
  const p = activity ? placeById(activity.placeId) : null;
  const city = cityById(trip.cityId);
  if (!activity || !p) return <Sheet visible={false} onClose={onClose}>{null}</Sheet>;

  const saved = trip.savedIds.includes(p.id);
  const visual = categoryVisualFor(p);
  const purchaseUrl = purchaseUrlFor(p);
  const ti = ticketInfo(p);
  const tiColor = ti.status === 'required' || ti.status === 'unconfirmed' ? t.warning : ti.status === 'free' || ti.status === 'none' ? t.secondary : t.primary;
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
      <PlaceImage place={p} style={styles.detailHero} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.three, flexWrap: 'wrap' }}>
        <View style={[styles.categoryBadge, { backgroundColor: visual.soft }]}>
          <Ionicons name={visual.icon} size={14} color={visual.color} />
          <Body style={{ color: visual.color, fontSize: 11, fontWeight: '900' }}>{visual.label}</Body>
        </View>
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
        <InfoLine icon="ticket-outline" label="Ticket" value={ti.label} warn={ti.status === 'required' || ti.status === 'unconfirmed'} />
        {p.openFrom && <InfoLine icon="storefront" label="Abre" value={`${p.openFrom}–${p.openTo ?? ''}`} />}
        {(p.confident === false || activity.note) && (
          <InfoLine icon="alert-circle" label="Aviso" value={activity.note ?? 'Horario/precio sujeto a cambios. Verificá en el sitio oficial.'} warn />
        )}
      </View>

      {(ti.ticket || ti.reservation) && (
        <View style={[styles.bookingPanel, { backgroundColor: t.secondarySoft }]}>
          <View style={[styles.bookingIcon, { backgroundColor: t.secondary }]}>
            <Ionicons name={ti.reservation ? 'restaurant-outline' : 'ticket-outline'} size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Body style={{ color: t.secondary, fontWeight: '800' }}>{ti.label}</Body>
            <Body style={{ color: t.secondary, fontSize: 12, marginTop: 2 }}>
              {ti.reservation
                ? 'Reservá desde el sitio oficial y guardá la confirmación en Rumbo.'
                : 'Comprá desde el sitio oficial y guardá después el ticket en Rumbo.'}
            </Body>
          </View>
          {purchaseUrl && (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Comprar entrada para ${p.name}`}
              onPress={() => Linking.openURL(purchaseUrl)}
              style={styles.bookingLink}>
              <Ionicons name="open-outline" size={18} color="#fff" />
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.actionGrid}>
        <Action icon="swap-horizontal" label="Reemplazar" onPress={() => onReplace(activity)} />
        <Action icon="calendar" label="Mover de día" onPress={() => onMove(activity)} />
        <Action icon={saved ? 'bookmark' : 'bookmark-outline'} label={saved ? 'Guardado' : 'Guardar'} onPress={() => { toggleSaved(trip.id, p.id); onToast(saved ? 'Quitado de guardados' : 'Lugar guardado'); }} />
        <Action icon="map" label="Abrir en Maps" onPress={openMaps} />
        {(ti.ticket || ti.reservation) && (
          <Action
            icon={ti.reservation ? 'calendar-outline' : 'ticket-outline'}
            label={ti.reservation ? 'Guardar reserva' : 'Guardar ticket'}
            onPress={() => onTicket(activity)}
          />
        )}
        <Action icon="trash" label="Eliminar" danger onPress={() => onRequestDelete(activity)} />
      </View>

      <Body muted style={{ fontSize: 11, marginTop: Spacing.three, textAlign: 'center' }}>
        Fuente: {p.source === 'openstreetmap' ? 'OpenStreetMap' : p.source === 'ticketmaster' ? 'Ticketmaster' : 'selección curada'} · Verificá horarios y precios en el sitio oficial
      </Body>
    </Sheet>
  );
}

function ActivityEditSheet({
  trip,
  activity,
  onClose,
  onSaved,
}: {
  trip: Trip;
  activity: Activity | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTheme();
  const update = useStore((s) => s.updateActivityDetails);
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('');
  const [status, setStatus] = useState<Activity['status']>('plan');
  const [error, setError] = useState<string | null>(null);
  const p = activity ? placeById(activity.placeId) : undefined;

  useEffect(() => {
    if (!activity) return;
    setTime(minToHHMM(activity.startMin));
    setDuration(String(activity.durationMin));
    setStatus(activity.status);
    setError(null);
  }, [activity]);

  const save = () => {
    if (!activity) return;
    const match = time.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    const parsedDuration = Number(duration);
    if (!match || !Number.isFinite(parsedDuration) || parsedDuration < 15 || parsedDuration > 720) {
      setError('Usá una hora válida y una duración entre 15 y 720 minutos.');
      return;
    }
    update(trip.id, activity.id, {
      startMin: Number(match[1]) * 60 + Number(match[2]),
      durationMin: Math.round(parsedDuration),
      status,
    });
    onSaved();
  };

  return (
    <Sheet visible={Boolean(activity)} onClose={onClose} title={p ? `Editar · ${p.name}` : 'Editar actividad'}>
      {activity && (
        <View style={{ gap: Spacing.three }}>
          <View style={styles.editFields}>
            <View style={{ flex: 1, gap: 6 }}>
              <Label>Hora de inicio</Label>
              <TextInput
                accessibilityLabel="Hora de inicio"
                value={time}
                onChangeText={setTime}
                placeholder="09:30"
                keyboardType="numbers-and-punctuation"
                placeholderTextColor={t.textSecondary}
                style={[styles.editInput, { color: t.text, borderColor: error ? t.error : t.border }]}
              />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Label>Duración</Label>
              <TextInput
                accessibilityLabel="Duración en minutos"
                value={duration}
                onChangeText={setDuration}
                placeholder="90 min"
                keyboardType="number-pad"
                placeholderTextColor={t.textSecondary}
                style={[styles.editInput, { color: t.text, borderColor: error ? t.error : t.border }]}
              />
            </View>
          </View>
          <View style={{ gap: 7 }}>
            <Label>Estado</Label>
            <View style={styles.statusChoices}>
              {([
                ['plan', 'Pendiente', 'time-outline'],
                ['reservado', 'Reservada', 'bookmark-outline'],
                ['hecho', 'Completada', 'checkmark-circle-outline'],
                ['saltado', 'Cancelada', 'close-circle-outline'],
              ] as const).map(([value, label, icon]) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: status === value }}
                  onPress={() => setStatus(value)}
                  style={[
                    styles.statusChoice,
                    { borderColor: status === value ? t.secondary : t.border, backgroundColor: status === value ? t.secondarySoft : t.surface },
                  ]}>
                  <Ionicons name={icon} size={17} color={status === value ? t.secondary : t.textSecondary} />
                  <Body style={{ fontSize: 11, fontWeight: '800', color: status === value ? t.secondary : t.textSecondary }}>{label}</Body>
                </Pressable>
              ))}
            </View>
          </View>
          {error && <Body style={{ color: t.error, fontSize: 12 }}>{error}</Body>}
          <Button title="Guardar cambios" icon="checkmark" onPress={save} />
        </View>
      )}
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
  const [detail, setDetail] = useState<ExportDetail>('complete');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const text = `Mi viaje a ${trip.cityName}\n${fmtRange(trip.startDate, trip.endDate)}\n${trip.days.length} días · ${trip.days.flatMap((day) => day.activities).length} actividades\nArmado con Rumbo`;
  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key); setError(null);
    try { await action(); onToast(success); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos completar la acción.'); }
    finally { setBusy(null); }
  };
  const opts = [
    { icon: 'share-social-outline', label: 'Menú del dispositivo', key: 'native', onPress: () => run('native', () => Share.share({ title: `Viaje a ${trip.cityName}`, message: text }), 'Menú para compartir abierto') },
    { icon: 'logo-whatsapp', label: 'WhatsApp', key: 'whatsapp', onPress: async () => { const url = `https://wa.me/?text=${encodeURIComponent(text)}`; if (!await Linking.canOpenURL(url)) throw new Error('WhatsApp no está disponible.'); await Linking.openURL(url); } },
    { icon: 'copy-outline', label: 'Copiar resumen', key: 'copy', onPress: () => run('copy', () => Clipboard.setStringAsync(text), 'Resumen copiado') },
    { icon: 'document-text-outline', label: 'Compartir PDF', key: 'pdf', onPress: () => run('pdf', () => shareTripPdf(trip, detail), 'PDF preparado para compartir') },
    { icon: 'calendar-outline', label: 'Agregar al calendario', key: 'calendar', onPress: () => run('calendar', () => exportTripCalendar(trip), 'Actividades agregadas al calendario') },
    { icon: 'download-outline', label: 'Compartir archivo .ics', key: 'ics', onPress: () => run('ics', () => shareCalendarFile(trip), 'Calendario preparado para compartir') },
    { icon: 'mail-outline', label: 'Enviar por correo', key: 'mail', onPress: () => Linking.openURL(`mailto:?subject=${encodeURIComponent(`Viaje a ${trip.cityName}`)}&body=${encodeURIComponent(text)}`) },
  ];
  return (
    <Sheet visible={visible} onClose={onClose} title="Compartir viaje">
      <View style={{ gap: 7 }}>
        <Label>Contenido del PDF</Label>
        <View style={styles.timePresets}>
          <Chip label="Resumen" selected={detail === 'summary'} onPress={() => setDetail('summary')} />
          <Chip label="Completo" selected={detail === 'complete'} onPress={() => setDetail('complete')} />
        </View>
      </View>
      {opts.map((o) => (
        <Pressable key={o.label} disabled={Boolean(busy)} onPress={o.onPress}>
          <Card style={styles.altRow}>
            <Ionicons name={o.icon as any} size={22} color={t.primary} />
            <Body style={{ flex: 1, fontWeight: '600' }}>{o.label}</Body>
            {busy === o.key ? <Body muted style={{ fontSize: 12 }}>Preparando…</Body> : <Ionicons name="chevron-forward" size={17} color={t.textSecondary} />}
          </Card>
        </Pressable>
      ))}
      <View style={[styles.sharePrivacy, { backgroundColor: t.backgroundElement }]}>
        <Ionicons name="lock-closed-outline" size={19} color={t.textSecondary} />
        <Body muted style={{ flex: 1, fontSize: 12 }}>
          Los enlaces públicos y las invitaciones no se muestran hasta configurar un backend con permisos. El PDF omite códigos de confirmación y datos personales.
        </Body>
      </View>
      {error && <Body style={{ color: t.error, fontSize: 12 }}>{error}</Body>}
    </Sheet>
  );
}

/* ============================ Pequeños ============================ */

function DaySelector({ trip, day, setDay }: { trip: Trip; day: number; setDay: (d: number) => void }) {
  const t = useTheme();
  return (
    <ScrollView
      horizontal
      style={styles.daySelectorViewport}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.daySelectorContent}>
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
  tripContent: { width: '100%', maxWidth: 920, alignSelf: 'center', gap: Spacing.three, paddingTop: Spacing.three, paddingBottom: 120 },
  header: { paddingBottom: 4 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.three, paddingTop: Spacing.one },
  headerIcon: { width: 38, height: 38, borderRadius: Radius.pill, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 2 },
  headerMeta: { flexDirection: 'row', gap: 8, marginTop: Spacing.two, flexWrap: 'wrap' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill },
  metaText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  tabsViewport: { flexGrow: 0, flexShrink: 0, height: 54, minHeight: 54, maxHeight: 54, borderBottomWidth: 1 },
  tabsContent: { width: '100%', height: 53, flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: Spacing.two },
  tab: { flex: 1, height: 53, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  tabInd: { position: 'absolute', bottom: 0, height: 3, width: 28, borderRadius: 2 },
  statGrid: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  statBox: { flexGrow: 1, flexBasis: '22%', alignItems: 'center', gap: 3, paddingVertical: Spacing.three },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  dayBadge: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  dayHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dayStartButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: Radius.md, borderWidth: 1 },
  timePresets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  alert: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: 1.5 },
  tripTools: { gap: Spacing.two },
  logisticsCard: { gap: Spacing.two },
  logisticsHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginBottom: 2 },
  tripTool: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  tripToolIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  actRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  actDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  hotelTimeline: { flex: 1, minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Radius.md, paddingHorizontal: Spacing.three },
  boundaryTimeline: { flex: 1, minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.three },
  activityMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  categoryBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: Radius.pill },
  quickActions: { flexDirection: 'row', borderTopWidth: 1, marginTop: 7, paddingTop: 8 },
  quickAction: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', gap: 2 },
  legRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  legLine: { width: 2, height: 22 },
  legPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill },
  reorderActions: { flexDirection: 'column', gap: 4, paddingTop: 2 },
  reorderButton: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  mapCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  viewSwitch: { flexDirection: 'row', padding: 4, borderRadius: Radius.md, gap: 4 },
  viewSwitchButton: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12 },
  utilitySwitch: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: Radius.md },
  utilityButton: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12 },
  mapNum: { width: 30, height: 30, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  countPill: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: Radius.pill },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  placeCategoryIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  detailHero: { width: '100%', height: 190, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.one },
  activityThumb: { width: 48, height: 48, borderRadius: 14 },
  bookingPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    marginTop: Spacing.three,
    borderRadius: Radius.md,
  },
  bookingIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  bookingLink: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#16A085', alignItems: 'center', justifyContent: 'center' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.four },
  editFields: { flexDirection: 'row', gap: Spacing.two },
  editInput: { minHeight: 52, borderWidth: 1.5, borderRadius: Radius.md, paddingHorizontal: 13, fontSize: 16 },
  statusChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  statusChoice: { minHeight: 44, flexGrow: 1, flexBasis: '46%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 9 },
  action: { width: '31%', flexGrow: 1, alignItems: 'center', gap: 6, paddingVertical: Spacing.three, borderWidth: 1, borderRadius: Radius.md },
  altRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  ticketEmpty: { alignItems: 'center', gap: 9, borderRadius: Radius.lg, padding: Spacing.four },
  ticketEmptyIcon: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  ticketCard: { flexDirection: 'row', borderRadius: Radius.lg, overflow: 'hidden' },
  ticketStripe: { width: 7 },
  ticketBody: { flex: 1, padding: Spacing.three, gap: Spacing.three },
  ticketHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  ticketGlyph: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  codeBox: { borderRadius: Radius.md, padding: Spacing.three, gap: 3 },
  ticketActions: { flexDirection: 'row', gap: Spacing.two },
  sharePrivacy: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: Spacing.three, borderRadius: Radius.md },
  dayPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.md, borderWidth: 1.5, alignItems: 'center' },
  daySelectorViewport: { flexGrow: 0, width: '100%', minHeight: 64, maxHeight: 76 },
  daySelectorContent: { gap: 8, alignItems: 'center', paddingRight: Spacing.three },
  toast: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderRadius: Radius.md },
});
