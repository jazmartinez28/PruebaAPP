import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { PlaceImage } from '@/components/place-image';
import { RouteMap, type MapStop } from '@/components/route-map';
import { Body, H2 } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { BUDGETS, CATEGORY_ICON, CATEGORY_LABEL, PACES } from '@/data/catalog';
import { cityById } from '@/data/cities';
import { placeById } from '@/data/places';
import { useTheme } from '@/hooks/use-theme';
import { categoryVisualFor } from '@/lib/category-style';
import { fmtDate } from '@/lib/dates';
import { fmtDist, legBetween, minToHHMM } from '@/lib/geo';
import { tripStats } from '@/lib/generate';
import { useStore } from '@/store/useStore';
import type { Day, Place, Trip } from '@/types';

type Props = {
  trip: Trip;
  onOpenDay: (day: number) => void;
  onOpenMap: () => void;
  onEditHotel: () => void;
  onOpenTickets: () => void;
  onRegenerate: () => void;
};

const GROUP_LABEL = {
  solo: 'viaje solo',
  pareja: 'viaje en pareja',
  amigos: 'viaje con amigos',
  familia: 'viaje en familia',
  trabajo: 'viaje de trabajo',
  otro: 'viaje en grupo',
} as const;

const INTERCITY_MODES = [
  { id: 'train', label: 'Tren', icon: 'train-outline' },
  { id: 'flight', label: 'Avión', icon: 'airplane-outline' },
  { id: 'bus', label: 'Bus', icon: 'bus-outline' },
  { id: 'car', label: 'Auto', icon: 'car-outline' },
  { id: 'ferry', label: 'Ferry', icon: 'boat-outline' },
] as const;

function humanList(values: string[]) {
  if (values.length <= 1) return values[0] ?? '';
  return `${values.slice(0, -1).join(', ')} y ${values.at(-1)}`;
}

function dayEnd(day: Day) {
  return day.activities.reduce(
    (latest, activity) => Math.max(latest, activity.startMin + activity.durationMin),
    day.startMin ?? 9 * 60,
  );
}

export function TripSummary({
  trip,
  onOpenDay,
  onOpenMap,
  onEditHotel,
  onOpenTickets,
  onRegenerate,
}: Props) {
  const t = useTheme();
  const updateIntercityLeg = useStore((state) => state.updateIntercityLeg);
  const stats = tripStats(trip.days);
  const destinations = trip.destinations?.length
    ? trip.destinations.slice().sort((a, b) => a.order - b.order)
    : [{ cityId: trip.cityId, cityName: trip.cityName, country: trip.country, days: trip.days.length, order: 0 }];
  const destinationNames = destinations.map((destination) => destination.cityName);
  const activities = trip.days.flatMap((day) => day.activities);
  const plannedPlaces = activities
    .map((activity) => placeById(activity.placeId))
    .filter((place): place is Place => Boolean(place));
  const mealCount = plannedPlaces.filter((place) => place.isMeal).length;
  const visitCount = Math.max(
    plannedPlaces.filter((place) => !place.isMeal).length,
    activities.length - mealCount,
  );
  const personalizedCount = plannedPlaces.filter((place) =>
    place.categories.some((category) => trip.interests.includes(category)),
  ).length;
  const essentialCount = plannedPlaces.filter(
    (place) => place.categories.includes('iconico') || trip.mustSeeIds.includes(place.id),
  ).length;

  let totalMeters = 0;
  let totalTransferMinutes = 0;
  const allStops: MapStop[] = [];
  let stopIndex = 0;
  trip.days.forEach((day) => {
    day.activities.forEach((activity, activityIndex) => {
      const place = placeById(activity.placeId);
      if (!place) return;
      stopIndex++;
      allStops.push({
        id: activity.id,
        lat: place.lat,
        lng: place.lng,
        name: place.name,
        index: stopIndex,
        color: categoryVisualFor(place).color,
      });
      const next = day.activities[activityIndex + 1];
      const nextPlace = next ? placeById(next.placeId) : undefined;
      if (nextPlace) {
        const leg = legBetween(place, nextPlace);
        totalMeters += leg.meters;
        totalTransferMinutes += leg.minutes;
      }
    });
  });

  const bookingPlaces = plannedPlaces.filter((place) => place.needsBooking);
  const ticketPlaceIds = new Set((trip.tickets ?? []).map((ticket) => ticket.placeId));
  const pendingBookings = bookingPlaces.filter((place) => !ticketPlaceIds.has(place.id)).length;
  const pace = PACES.find((option) => option.id === trip.pace);
  const budget = BUDGETS.find((option) => option.id === trip.budget);
  const interestLabels = trip.interests.map((category) => CATEGORY_LABEL[category]);
  const planFocus = humanList(interestLabels.slice(0, 3));
  const routeLabel = totalMeters > 0 ? fmtDist(totalMeters) : activities.length > 1 ? 'A recalcular' : '0 m';
  const transferCopy = totalTransferMinutes > 0
    ? `${totalTransferMinutes} min estimados de traslado entre actividades, agrupadas por cercanía.`
    : activities.length > 1
      ? 'Reoptimizá el plan para actualizar distancias y traslados con el catálogo más reciente.'
      : 'Las próximas actividades aparecerán conectadas por cercanía.';

  return (
    <View style={styles.summary}>
      <View style={[styles.brief, { backgroundColor: t.secondary }]}>
        <View style={styles.briefHeading}>
          <View style={styles.briefCopy}>
            <Body style={styles.briefTitle}>
              {stats.days} {stats.days === 1 ? 'día' : 'días'} para {destinations.length > 1 ? `conectar ${destinations.length} ciudades` : `descubrir ${trip.cityName}`}
            </Body>
            <Body style={styles.briefText}>
              Priorizamos {planFocus || 'lo mejor de cada destino'} y sumamos clásicos que vale la pena conocer. {destinations.length > 1 ? `La ruta sigue ${humanList(destinationNames)} y separa cada ciudad en jornadas claras.` : 'El recorrido está ordenado por zonas para aprovechar el tiempo sin cruzar la ciudad de más.'}
            </Body>
          </View>
          <View style={styles.briefMark}>
            <Ionicons name="navigate" size={25} color="#FFFFFF" />
          </View>
        </View>

        <View style={styles.briefMetrics}>
          <BriefMetric value={String(visitCount)} label="visitas" />
          <View style={styles.briefDivider} />
          <BriefMetric value={String(stats.zones)} label="zonas" />
          <View style={styles.briefDivider} />
          <BriefMetric value={routeLabel} label="recorrido" />
        </View>

        <View style={styles.briefActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir el itinerario del día 1"
            onPress={() => onOpenDay(0)}
            style={({ pressed }) => [styles.primaryBriefAction, pressed && styles.pressed]}>
            <Ionicons name="map-outline" size={18} color={t.secondary} />
            <Body style={[styles.primaryBriefActionText, { color: t.secondary }]}>Ver mi plan</Body>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reoptimizar el viaje con mis preferencias"
            onPress={onRegenerate}
            style={({ pressed }) => [styles.secondaryBriefAction, pressed && styles.pressed]}>
            <Ionicons name="sparkles-outline" size={18} color="#FFFFFF" />
            <Body style={styles.secondaryBriefActionText}>Reoptimizar</Body>
          </Pressable>
        </View>
      </View>

      {destinations.length > 1 && (
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View style={{ flex: 1 }}>
              <H2>Entre una ciudad y la siguiente</H2>
              <Body muted style={styles.sectionDescription}>Elegí cómo pensás moverte ahora o dejalo pendiente para completarlo cuando tengas la reserva.</Body>
            </View>
            <View style={[styles.fitBadge, { backgroundColor: t.secondarySoft }]}>
              <Ionicons name="trail-sign-outline" size={16} color={t.secondary} />
              <Body style={{ color: t.secondary, fontSize: 12, fontWeight: '800' }}>{destinations.length - 1} tramos</Body>
            </View>
          </View>
          <View style={[styles.intercityRoute, { backgroundColor: t.surface, borderColor: t.border }]}>
            {(trip.intercityLegs ?? []).map((leg, index) => {
              const from = cityById(leg.fromCityId);
              const to = cityById(leg.toCityId);
              return (
                <View key={leg.id} style={styles.intercityLeg}>
                  <View style={styles.intercityHeading}>
                    <View style={[styles.intercityNumber, { backgroundColor: t.secondary }]}><Body style={styles.intercityNumberText}>{index + 1}</Body></View>
                    <View style={{ flex: 1 }}>
                      <Body style={{ fontWeight: '900' }}>{from?.name ?? 'Origen'} → {to?.name ?? 'Destino'}</Body>
                      <Body muted style={{ fontSize: 11 }}>{leg.status === 'confirmed' ? 'Medio definido · podés cambiarlo' : 'Traslado pendiente de definir'}</Body>
                    </View>
                  </View>
                  <View style={styles.intercityModes}>
                    {INTERCITY_MODES.map((mode) => {
                      const selected = leg.mode === mode.id;
                      return (
                        <Pressable
                          key={mode.id}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          accessibilityLabel={`${mode.label} de ${from?.name} a ${to?.name}`}
                          onPress={() => updateIntercityLeg(trip.id, leg.id, { mode: mode.id, status: 'confirmed' })}
                          style={[styles.intercityMode, { backgroundColor: selected ? t.secondarySoft : t.backgroundElement }]}>
                          <Ionicons name={mode.icon} size={16} color={selected ? t.secondary : t.textSecondary} />
                          <Body style={{ color: selected ? t.secondary : t.textSecondary, fontSize: 11, fontWeight: '800' }}>{mode.label}</Body>
                        </Pressable>
                      );
                    })}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Definir después el traslado de ${from?.name} a ${to?.name}`}
                      onPress={() => updateIntercityLeg(trip.id, leg.id, { mode: 'unknown', status: 'pending' })}
                      style={[styles.intercityMode, { backgroundColor: leg.mode === 'unknown' ? t.primarySoft : t.backgroundElement }]}>
                      <Ionicons name="time-outline" size={16} color={leg.mode === 'unknown' ? t.primaryStrong : t.textSecondary} />
                      <Body style={{ color: leg.mode === 'unknown' ? t.primaryStrong : t.textSecondary, fontSize: 11, fontWeight: '800' }}>Después</Body>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <View style={{ flex: 1 }}>
            <H2>Hecho a tu medida</H2>
            <Body muted style={styles.sectionDescription}>
              {personalizedCount} actividades responden directamente a lo que elegiste; {essentialCount} {essentialCount === 1 ? 'es imprescindible' : 'son imprescindibles'} de {trip.cityName}.
            </Body>
          </View>
          <View style={[styles.fitBadge, { backgroundColor: t.primarySoft }]}>
            <Ionicons name="options-outline" size={16} color={t.primaryStrong} />
            <Body style={{ color: t.primaryStrong, fontSize: 12, fontWeight: '800' }}>{pace?.label}</Body>
          </View>
        </View>

        <View style={styles.interestList}>
          {trip.interests.map((category) => {
            const count = plannedPlaces.filter((place) => place.categories.includes(category)).length;
            return (
              <View key={category} style={[styles.interestChip, { backgroundColor: t.surface, borderColor: t.border }]}>
                <Ionicons name={CATEGORY_ICON[category]} size={15} color={count ? t.secondary : t.textSecondary} />
                <Body style={{ flexShrink: 1, fontSize: 12, fontWeight: '700' }}>{CATEGORY_LABEL[category]}</Body>
                <Body style={{ color: count ? t.secondary : t.textSecondary, fontSize: 12, fontWeight: '900' }}>{count}</Body>
              </View>
            );
          })}
        </View>

        <Body muted style={styles.profileLine}>
          {pace?.label ?? 'Equilibrado'} · {budget?.label ?? 'Presupuesto flexible'}
          {trip.groupType ? ` · ${GROUP_LABEL[trip.groupType]}` : ''}
          {mealCount ? ` · ${mealCount} ${mealCount === 1 ? 'comida prevista' : 'comidas previstas'}` : ''}
        </Body>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <View style={{ flex: 1 }}>
            <H2>La ciudad, sin vueltas</H2>
            <Body muted style={styles.sectionDescription}>
              {transferCopy}
            </Body>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir el mapa completo del viaje"
            onPress={onOpenMap}
            hitSlop={8}
            style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}>
            <Body style={{ color: t.secondary, fontWeight: '800', fontSize: 13 }}>Ver mapa</Body>
            <Ionicons name="arrow-forward" size={16} color={t.secondary} />
          </Pressable>
        </View>
        <View style={[styles.mapFrame, { backgroundColor: t.surface, borderColor: t.border }]}>
          <RouteMap stops={allStops} accommodation={trip.accommodation} height={214} />
        </View>
      </View>

      <View style={styles.section}>
        <View>
          <H2>Tu viaje, día por día</H2>
          <Body muted style={styles.sectionDescription}>La idea central de cada jornada y sus paradas más importantes.</Body>
        </View>
        <View style={styles.dayList}>
          {trip.days.map((day, index) => (
            <SummaryDay key={`${day.date}-${index}`} day={day} index={index} onPress={() => onOpenDay(index)} />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View>
          <H2>Antes de salir</H2>
          <Body muted style={styles.sectionDescription}>Lo que conviene resolver para que el viaje fluya sin imprevistos.</Body>
        </View>
        <View style={[styles.readiness, { backgroundColor: t.surface, borderColor: t.border }]}>
          <ActionRow
            icon="bed-outline"
            iconColor={trip.accommodation ? t.secondary : t.warning}
            iconBackground={trip.accommodation ? t.secondarySoft : `${t.warning}18`}
            title={trip.accommodation ? 'Tu base está definida' : 'Agregá tu alojamiento'}
            detail={trip.accommodation?.address ?? trip.accommodation?.name ?? 'Así calculamos la salida y el regreso de cada día.'}
            onPress={onEditHotel}
          />
          <View style={[styles.readinessDivider, { backgroundColor: t.border }]} />
          <ActionRow
            icon="ticket-outline"
            iconColor={pendingBookings ? t.primary : t.secondary}
            iconBackground={pendingBookings ? t.primarySoft : t.secondarySoft}
            title={pendingBookings ? `${pendingBookings} ${pendingBookings === 1 ? 'reserva pendiente' : 'reservas pendientes'}` : 'Tickets y reservas bajo control'}
            detail={(trip.tickets ?? []).length ? `${trip.tickets.length} documentos guardados y accesibles por actividad.` : bookingPlaces.length ? 'Guardá aquí cada confirmación para encontrarla durante el viaje.' : 'No detectamos reservas críticas por ahora.'}
            onPress={onOpenTickets}
          />
          {(trip.arrivalTime != null || trip.departureTime != null) && (
            <>
              <View style={[styles.readinessDivider, { backgroundColor: t.border }]} />
              <View style={styles.logisticsRow}>
                <View style={[styles.actionIcon, { backgroundColor: t.secondarySoft }]}>
                  <Ionicons name="navigate-outline" size={21} color={t.secondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Body style={styles.actionTitle}>Llegada y salida protegidas</Body>
                  {trip.arrivalTime != null && (
                    <Body muted style={styles.logisticsDetail}>
                      Llegada {minToHHMM(trip.arrivalTime)} · {trip.arrivalPlace || 'punto de llegada'} · {trip.arrivalBufferMin ?? 45} min de margen
                    </Body>
                  )}
                  {trip.departureTime != null && (
                    <Body muted style={styles.logisticsDetail}>
                      Salida {minToHHMM(trip.departureTime)} · llegar {trip.departureLeadMin ?? 120} min antes
                    </Body>
                  )}
                </View>
              </View>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

function BriefMetric({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.briefMetric}>
      <Body style={styles.briefMetricValue}>{value}</Body>
      <Body style={styles.briefMetricLabel}>{label}</Body>
    </View>
  );
}

function SummaryDay({ day, index, onPress }: { day: Day; index: number; onPress: () => void }) {
  const t = useTheme();
  const places = day.activities
    .map((activity) => placeById(activity.placeId))
    .filter((place): place is Place => Boolean(place));
  const hero = places.find((place) => !place.isMeal) ?? places[0];
  const visitHighlights = places.filter((place) => !place.isMeal);
  const highlights = (visitHighlights.length ? visitHighlights : places).slice(0, 3).map((place) => place.name);
  const end = dayEnd(day);
  const visual = hero ? categoryVisualFor(hero) : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir el plan del día ${index + 1}, ${day.zone || 'día libre'}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.dayCard,
        { backgroundColor: t.surface, borderColor: t.border },
        pressed && styles.pressed,
      ]}>
      {hero ? (
        <PlaceImage place={hero} compact style={styles.dayImage} />
      ) : (
        <View style={[styles.dayImage, styles.dayImageEmpty, { backgroundColor: t.secondarySoft }]}>
          <Ionicons name="cafe-outline" size={24} color={t.secondary} />
        </View>
      )}
      <View style={styles.dayCopy}>
        <View style={styles.dayTopline}>
          <View style={[styles.dayNumber, { backgroundColor: visual?.soft ?? t.primarySoft }]}>
            <Body style={{ color: visual?.color ?? t.primaryStrong, fontSize: 12, fontWeight: '900' }}>D{index + 1}</Body>
          </View>
          {day.cityName && <Body style={{ color: t.secondary, fontSize: 11, fontWeight: '900' }}>{day.cityName}</Body>}
          <Body muted style={{ fontSize: 12 }}>{fmtDate(day.date)}</Body>
        </View>
        <Body numberOfLines={1} style={styles.dayTitle}>{day.zone || 'Día libre para improvisar'}</Body>
        <Body muted numberOfLines={2} style={styles.dayHighlights}>
          {highlights.length
            ? highlights.join(' · ')
            : day.activities.length
              ? `Plan de ${day.activities.length} paradas listo para revisar.`
              : 'Todavía no hay actividades para este día.'}
        </Body>
        <View style={styles.dayMeta}>
          <Ionicons name="time-outline" size={14} color={t.textSecondary} />
          <Body muted style={styles.dayMetaText}>{minToHHMM(day.startMin ?? 9 * 60)}–{minToHHMM(end)}</Body>
          <Ionicons name="location-outline" size={14} color={t.textSecondary} />
          <Body muted style={styles.dayMetaText}>{day.activities.length} paradas</Body>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={19} color={t.textSecondary} />
    </Pressable>
  );
}

function ActionRow({
  icon,
  iconColor,
  iconBackground,
  title,
  detail,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBackground: string;
  title: string;
  detail: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>
      <View style={[styles.actionIcon, { backgroundColor: iconBackground }]}>
        <Ionicons name={icon} size={21} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Body style={styles.actionTitle}>{title}</Body>
        <Body muted numberOfLines={2} style={styles.actionDetail}>{detail}</Body>
      </View>
      <Ionicons name="chevron-forward" size={18} color={t.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summary: { gap: Spacing.five },
  brief: { padding: Spacing.four, borderRadius: Radius.lg, gap: Spacing.four, overflow: 'hidden' },
  briefHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  briefCopy: { flex: 1, gap: Spacing.two },
  briefTitle: { color: '#FFFFFF', fontSize: 24, lineHeight: 29, fontWeight: '900', letterSpacing: -0.35 },
  briefText: { color: 'rgba(255,255,255,0.88)', fontSize: 14, lineHeight: 21 },
  briefMark: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  briefMetrics: { minHeight: 54, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: Radius.md, paddingHorizontal: Spacing.two },
  briefMetric: { flex: 1, alignItems: 'center', gap: 1 },
  briefMetricValue: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  briefMetricLabel: { color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: '600' },
  briefDivider: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.2)' },
  briefActions: { flexDirection: 'row', gap: Spacing.two },
  primaryBriefAction: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: Radius.md, backgroundColor: '#FFFFFF', paddingHorizontal: Spacing.three },
  primaryBriefActionText: { fontSize: 14, fontWeight: '900' },
  secondaryBriefAction: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: Radius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', paddingHorizontal: Spacing.three },
  secondaryBriefActionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  section: { gap: Spacing.three },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  sectionDescription: { marginTop: 3, fontSize: 13, lineHeight: 19 },
  fitBadge: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: Radius.pill, paddingHorizontal: 11 },
  intercityRoute: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.three },
  intercityLeg: { gap: 10, paddingVertical: 14 },
  intercityHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  intercityNumber: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  intercityNumberText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  intercityModes: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingLeft: 38 },
  intercityMode: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderRadius: Radius.pill },
  interestList: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  interestChip: { minHeight: 38, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: 11 },
  profileLine: { fontSize: 12, lineHeight: 18 },
  textAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 4 },
  mapFrame: { borderWidth: 1, borderRadius: Radius.lg, overflow: 'hidden' },
  dayList: { gap: Spacing.two },
  dayCard: { minHeight: 130, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden', paddingRight: Spacing.three },
  dayImage: { width: 112, alignSelf: 'stretch' },
  dayImageEmpty: { alignItems: 'center', justifyContent: 'center' },
  dayCopy: { flex: 1, paddingVertical: 12, gap: 5 },
  dayTopline: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dayNumber: { minWidth: 30, height: 25, alignItems: 'center', justifyContent: 'center', borderRadius: 8, paddingHorizontal: 6 },
  dayTitle: { fontSize: 16, lineHeight: 20, fontWeight: '900' },
  dayHighlights: { fontSize: 12, lineHeight: 17 },
  dayMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  dayMetaText: { fontSize: 11, marginRight: 5 },
  readiness: { borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden' },
  readinessDivider: { height: 1, marginLeft: 68 },
  actionRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: 12 },
  actionIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: 14, fontWeight: '900' },
  actionDetail: { marginTop: 2, fontSize: 12, lineHeight: 17 },
  logisticsRow: { minHeight: 78, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: 14 },
  logisticsDetail: { marginTop: 3, fontSize: 12, lineHeight: 17 },
  pressed: { opacity: 0.76 },
});
