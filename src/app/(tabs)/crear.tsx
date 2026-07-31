import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TAB_BAR_HEIGHT } from '@/components/app-tabs';
import { Calendar } from '@/components/calendar';
import { CityImage } from '@/components/city-image';
import { ProgressBar, TopBar } from '@/components/flow-ui';
import { JourneyRoute } from '@/components/journey-route';
import { Body, Button, Card, Chip, H1, Label } from '@/components/ui';
import { CITY_CURRENCY, REMOTE_CONFIG } from '@/constants/config';
import { Radius, Spacing } from '@/constants/theme';
import { BUDGETS, CATEGORY_LABEL, INTERESTS, PACES } from '@/data/catalog';
import { CITIES, cityById } from '@/data/cities';
import { placesByCity } from '@/data/places';
import { useTheme } from '@/hooks/use-theme';
import { daysInclusive, fmtRange } from '@/lib/dates';
import { centroid } from '@/lib/geo';
import {
  geocodeAccommodation,
  type GeocodedAccommodation,
} from '@/lib/place-provider';
import { useStore } from '@/store/useStore';
import type { Accommodation, Budget, Draft, GroupType, TravelPointType } from '@/types';

const TOTAL = 8;
const STEP_LABELS = ['Destino', 'Fechas', 'Tu base', 'Intereses', 'Tu ritmo', 'Presupuesto', 'Imprescindibles', 'Revisión'];
const STEP_ACTIONS = ['Elegir fechas', 'Definir mi base', 'Elegir intereses', 'Definir mi ritmo', 'Elegir presupuesto', 'Sumar imprescindibles', 'Revisar mi viaje', 'Crear mi itinerario'];

const PARTY: { n: number; label: string }[] = [
  { n: 1, label: 'Solo' },
  { n: 2, label: '2' },
  { n: 3, label: '3' },
  { n: 4, label: '4' },
  { n: 5, label: '5+' },
];
const GROUP: { id: GroupType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'pareja', label: 'Pareja', icon: 'heart-outline' },
  { id: 'amigos', label: 'Amigos', icon: 'people-outline' },
  { id: 'familia', label: 'Familia', icon: 'home-outline' },
  { id: 'trabajo', label: 'Trabajo', icon: 'briefcase-outline' },
];
const DAY_STARTS: { min: number; label: string; sub: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { min: 8 * 60, label: '08:00', sub: 'Soy madrugador/a', icon: 'sunny-outline' },
  { min: 9 * 60, label: '09:00', sub: 'Horario equilibrado', icon: 'partly-sunny-outline' },
  { min: 10 * 60, label: '10:00', sub: 'Prefiero empezar tarde', icon: 'cafe-outline' },
];

export default function CrearScreen() {
  const t = useTheme();
  const router = useRouter();
  const draft = useStore((s) => s.draft);
  const setDraft = useStore((s) => s.setDraft);
  const toggleInterest = useStore((s) => s.toggleInterest);
  const toggleMustSee = useStore((s) => s.toggleMustSee);
  const setAccommodation = useStore((s) => s.setAccommodation);
  const loadCityCatalog = useStore((s) => s.loadCityCatalog);
  const loadTripEvents = useStore((s) => s.loadTripEvents);
  const catalogStatus = useStore((s) => (s.draft.cityId ? s.catalogStatus[s.draft.cityId] : 'idle'));
  const eventKey = draft.cityId && draft.startDate && draft.endDate
    ? `${draft.cityId}:${draft.startDate}:${draft.endDate}`
    : '';
  const eventStatus = useStore((s) => (eventKey ? s.eventStatus[eventKey] ?? 'idle' : 'idle'));
  const addManualMustSee = useStore((s) => s.addManualMustSee);
  useStore((s) => s.externalPlaces);

  const [step, setStep] = useState(0);
  const [query, setQuery] = useState('');
  const [accChoice, setAccChoice] = useState<'yes' | 'no' | 'later' | null>(
    draft.accommodation ? 'yes' : null,
  );
  const [hotelQuery, setHotelQuery] = useState(draft.accommodation?.address ?? '');
  const [hotelResults, setHotelResults] = useState<GeocodedAccommodation[]>([]);
  const [hotelLoading, setHotelLoading] = useState(false);
  const [hotelError, setHotelError] = useState<string | null>(null);
  const [mustQuery, setMustQuery] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualReference, setManualReference] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const direction = useRef(1);
  const stepMotion = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);

  const cityPlaces = draft.cityId ? placesByCity(draft.cityId) : [];
  const zones = useMemo(() => Array.from(new Set(cityPlaces.map((p) => p.zone))), [draft.cityId]);
  const filteredCities = CITIES.filter(
    (c) => !query || `${c.name} ${c.country}`.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    if (!draft.cityId || !draft.startDate || !draft.endDate) return;
    void loadTripEvents(draft.cityId, draft.startDate, draft.endDate);
  }, [draft.cityId, draft.startDate, draft.endDate, loadTripEvents]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: !reducedMotion });
    if (reducedMotion) {
      stepMotion.setValue(1);
      return;
    }
    stepMotion.setValue(0);
    Animated.timing(stepMotion, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, [reducedMotion, step, stepMotion]);

  const canContinue = () => {
    if (step === 0) return !!draft.cityId;
    if (step === 1) return !!draft.startDate && !!draft.endDate;
    if (step === 2 && accChoice === 'yes') return Boolean(draft.accommodation);
    if (step === 3) return draft.interests.length > 0;
    return true;
  };

  const back = () => {
    if (step === 0) {
      router.push('/');
      return;
    }
    direction.current = -1;
    void Haptics.selectionAsync();
    setStep((s) => s - 1);
  };
  const next = () => {
    direction.current = 1;
    if (step < TOTAL - 1) {
      void Haptics.selectionAsync();
      setStep((s) => s + 1);
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push('/generando');
    }
  };

  const chooseZone = (zone: string) => {
    const pts = cityPlaces.filter((p) => p.zone === zone);
    const c = centroid(pts);
    const acc: Accommodation = { name: `Zona ${zone}`, lat: c.lat, lng: c.lng, zone };
    setAccommodation(acc);
  };

  const searchHotel = async () => {
    const city = draft.cityId ? cityById(draft.cityId) : undefined;
    if (!city || hotelQuery.trim().length < 3) {
      setHotelError('Escribí el nombre del hotel o una dirección completa.');
      return;
    }
    setHotelLoading(true);
    setHotelError(null);
    try {
      const results = await geocodeAccommodation(hotelQuery.trim(), city);
      setHotelResults(results);
      if (!results.length) setHotelError('No encontramos esa dirección. Probá agregando calle y número.');
    } catch {
      setHotelError('No pudimos buscar ahora. Podés elegir el barrio como alternativa.');
    } finally {
      setHotelLoading(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.background }}>
      <TopBar onBack={back} title="Planificar viaje" />
      <ProgressBar step={step} total={TOTAL} label={`${STEP_LABELS[step]} · Paso ${step + 1} de ${TOTAL}`} />

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.flowContent}
        keyboardShouldPersistTaps="handled">
        <Animated.View
          key={step}
          style={[
            styles.stepStage,
            {
              opacity: stepMotion,
              transform: [{ translateX: reducedMotion ? 0 : stepMotion.interpolate({ inputRange: [0, 1], outputRange: [direction.current * 24, 0] }) }],
            },
          ]}>
        <View style={[styles.routePreview, { backgroundColor: t.secondarySoft }]}>
          <View style={styles.routePreviewCopy}>
            <Body style={{ color: t.secondary, fontWeight: '900', fontSize: 12 }}>TU RUTA SE ESTÁ ARMANDO</Body>
            <Body style={{ color: t.secondary, fontSize: 12 }}>{step + 1} de {TOTAL} decisiones listas</Body>
          </View>
          <JourneyRoute compact completion={(step + 1) / TOTAL} labels={STEP_LABELS.slice(Math.max(0, step - 1), Math.max(0, step - 1) + 3)} />
        </View>
        {/* ---------- Paso 1: Destino ---------- */}
        {step === 0 && (
          <>
            <StepIntro icon="location-outline" title="¿A dónde vas?" description="Elegí la ciudad y empezamos a construir un viaje pensado para vos." />
            <View style={[styles.search, { backgroundColor: t.surface, borderColor: t.border }]}>
              <Ionicons name="search" size={18} color={t.textSecondary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar ciudad o país"
                placeholderTextColor={t.textSecondary}
                style={{ flex: 1, color: t.text, fontSize: 15 }}
              />
            </View>
            <View style={{ gap: Spacing.two }}>
              {filteredCities.map((c) => {
                const sel = draft.cityId === c.id;
                return (
                  <Pressable
                    key={c.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Elegir ${c.name}, ${c.country}`}
                    accessibilityState={{ selected: sel }}
                    onPress={() => {
                      setDraft({ cityId: c.id, cityName: c.name, country: c.country });
                      void loadCityCatalog(c.id);
                    }}>
                    <View style={[styles.cityCard, { borderColor: sel ? t.primary : t.border, backgroundColor: t.surface }]}>
                      <CityImage city={c} scrim={0.08} style={styles.cityThumb} />
                      <View style={{ flex: 1 }}>
                        <Body style={{ fontWeight: '700', fontSize: 16 }}>{c.name}</Body>
                        <Body muted style={{ fontSize: 13 }}>
                          {c.country}
                        </Body>
                      </View>
                      {sel && <Ionicons name="checkmark-circle" size={24} color={t.primary} />}
                    </View>
                  </Pressable>
                );
              })}
              {filteredCities.length === 0 && (
                <Body muted style={{ textAlign: 'center', paddingVertical: Spacing.four }}>
                  Por ahora tenemos estas ciudades. ¡Vamos a sumar más!
                </Body>
              )}
            </View>
          </>
        )}

        {/* ---------- Paso 2: Fechas ---------- */}
        {step === 1 && (
          <>
            <StepIntro icon="calendar-outline" title="¿Cuándo viajás?" description="Usamos las fechas para distribuir cada zona sin apurar el recorrido." />
            <Calendar
              start={draft.startDate}
              end={draft.endDate}
              onChange={(s, e) => setDraft({ startDate: s, endDate: e })}
            />
            {draft.startDate && draft.endDate && (
              <>
                <Card style={styles.rangeInfo}>
                  <Ionicons name="calendar" size={20} color={t.secondary} />
                  <Body style={{ fontWeight: '700' }}>
                    {fmtRange(draft.startDate, draft.endDate)} ·{' '}
                    {daysInclusive(draft.startDate, draft.endDate)} días
                  </Body>
                </Card>
                <TravelBoundaryEditor kind="arrival" draft={draft} setDraft={setDraft} />
                <TravelBoundaryEditor kind="departure" draft={draft} setDraft={setDraft} />
              </>
            )}
          </>
        )}

        {/* ---------- Paso 3: Alojamiento ---------- */}
        {step === 2 && (
          <>
            <StepIntro icon="bed-outline" title="¿Dónde te vas a alojar?" description="Tu alojamiento será el punto de salida y regreso de cada día." optional />
            {[
              { id: 'yes', label: 'Ya tengo alojamiento', icon: 'bed' },
              { id: 'no', label: 'Todavía no lo decidí', icon: 'help-circle' },
              { id: 'later', label: 'Lo agrego después', icon: 'time' },
            ].map((o) => {
              const sel = accChoice === o.id;
              return (
                <Pressable
                  key={o.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sel }}
                  onPress={() => {
                    setAccChoice(o.id as any);
                    if (o.id !== 'yes') setAccommodation(null);
                  }}>
                  <Card style={[styles.optRow, sel && { borderColor: t.primary, borderWidth: 2 }]}>
                    <Ionicons name={o.icon as any} size={22} color={sel ? t.primary : t.textSecondary} />
                    <Body style={{ flex: 1, fontWeight: sel ? '700' : '500' }}>{o.label}</Body>
                    {sel && <Ionicons name="checkmark-circle" size={22} color={t.primary} />}
                  </Card>
                </Pressable>
              );
            })}
            {accChoice === 'yes' && (
              <View style={{ gap: Spacing.three }}>
                <View style={{ gap: Spacing.two }}>
                  <Label>Hotel o dirección</Label>
                  <View style={[styles.hotelSearch, { backgroundColor: t.surface, borderColor: hotelError ? t.error : t.border }]}>
                    <Ionicons name="bed-outline" size={20} color={t.textSecondary} />
                    <TextInput
                      value={hotelQuery}
                      onChangeText={setHotelQuery}
                      onSubmitEditing={searchHotel}
                      returnKeyType="search"
                      placeholder="Ej. Via Nazionale 22 o Hotel Artemide"
                      placeholderTextColor={t.textSecondary}
                      style={{ flex: 1, color: t.text, fontSize: 15 }}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Buscar alojamiento"
                      onPress={searchHotel}
                      style={[styles.searchHotelButton, { backgroundColor: t.primary }]}>
                      {hotelLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name="search" size={19} color="#fff" />
                      )}
                    </Pressable>
                  </View>
                  {hotelError && <Body style={{ color: t.error, fontSize: 13 }}>{hotelError}</Body>}
                </View>

                {hotelResults.map((result) => {
                  const selected =
                    draft.accommodation?.lat === result.lat && draft.accommodation?.lng === result.lng;
                  return (
                    <Pressable
                      key={`${result.lat}-${result.lng}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Usar ${result.name}`}
                      accessibilityState={{ selected }}
                      onPress={() =>
                        setAccommodation({
                          name: result.name,
                          address: result.address,
                          lat: result.lat,
                          lng: result.lng,
                        })
                      }>
                      <Card style={[styles.hotelResult, selected && { borderColor: t.secondary, borderWidth: 2 }]}>
                        <Ionicons name="location-outline" size={20} color={selected ? t.secondary : t.textSecondary} />
                        <View style={{ flex: 1 }}>
                          <Body style={{ fontWeight: '700' }}>{result.name}</Body>
                          <Body muted numberOfLines={2} style={{ fontSize: 12 }}>{result.address}</Body>
                        </View>
                        {selected && <Ionicons name="checkmark-circle" size={22} color={t.secondary} />}
                      </Card>
                    </Pressable>
                  );
                })}

                {draft.accommodation && (
                  <View style={[styles.hotelConfirmed, { backgroundColor: t.secondarySoft }]}>
                    <Ionicons name="checkmark-circle" size={20} color={t.secondary} />
                    <View style={{ flex: 1 }}>
                      <Body style={{ color: t.secondary, fontWeight: '800' }}>Base del viaje confirmada</Body>
                      <Body style={{ color: t.secondary, fontSize: 12 }} numberOfLines={2}>
                        {draft.accommodation.address ?? draft.accommodation.name}
                      </Body>
                    </View>
                  </View>
                )}

                <Label>O elegí un barrio aproximado</Label>
                <View style={styles.chips}>
                  {zones.map((z) => (
                    <Chip key={z} label={z} selected={draft.accommodation?.zone === z} onPress={() => chooseZone(z)} />
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {/* ---------- Paso 4: Intereses ---------- */}
        {step === 3 && (
          <>
            <StepIntro icon="sparkles-outline" title="¿Qué te gusta hacer?" description="Elegí varias opciones. Esto define qué lugares priorizamos para vos." />
            <View style={styles.chips}>
              {INTERESTS.map((i) => (
                <Chip
                  key={i.id}
                  label={i.label}
                  icon={i.icon}
                  selected={draft.interests.includes(i.id)}
                  onPress={() => toggleInterest(i.id)}
                />
              ))}
            </View>
          </>
        )}

        {/* ---------- Paso 5: Ritmo ---------- */}
        {step === 4 && (
          <>
            <StepIntro icon="speedometer-outline" title="¿A qué ritmo?" description="Definí cuánto querés hacer por día. Siempre dejamos tiempos de traslado y pausas." />
            {PACES.map((p) => {
              const sel = draft.pace === p.id;
              return (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sel }}
                  onPress={() => setDraft({ pace: p.id })}>
                  <Card style={[styles.paceCard, sel && { borderColor: t.primary, borderWidth: 2 }]}>
                    <View style={[styles.paceIcon, { backgroundColor: sel ? t.primary : t.primarySoft }]}>
                      <Ionicons name={p.icon} size={22} color={sel ? t.textOnPrimary : t.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Body style={{ fontWeight: '700', fontSize: 16 }}>{p.label}</Body>
                      <Body muted style={{ fontSize: 13 }}>
                        {p.desc}
                      </Body>
                    </View>
                    {sel && <Ionicons name="checkmark-circle" size={22} color={t.primary} />}
                  </Card>
                </Pressable>
              );
            })}

            {/* Cantidad de personas (#5) */}
            <View style={{ gap: Spacing.two, marginTop: Spacing.two }}>
              <Label>¿Cuántos viajan?</Label>
              <View style={styles.chips}>
                {PARTY.map((o) => (
                  <Chip key={o.n} label={o.label} selected={draft.partySize === o.n} onPress={() => setDraft({ partySize: o.n })} />
                ))}
              </View>
              {(draft.partySize ?? 0) >= 5 && (
                <View style={[styles.inlineField, { backgroundColor: t.surface, borderColor: t.border }]}>
                  <Ionicons name="people-outline" size={19} color={t.textSecondary} />
                  <TextInput
                    accessibilityLabel="Cantidad personalizada de personas"
                    value={String(draft.partySize ?? 5)}
                    onChangeText={(value) => setDraft({ partySize: Math.max(5, Math.min(99, Number(value.replace(/\D/g, '')) || 5)) })}
                    keyboardType="number-pad"
                    style={[styles.inlineInput, { color: t.text }]}
                  />
                  <Body muted style={{ fontSize: 12 }}>personas</Body>
                </View>
              )}
              <View style={styles.chips}>
                {GROUP.map((g) => (
                  <Chip
                    key={g.id}
                    label={g.label}
                    icon={g.icon}
                    selected={draft.groupType === g.id}
                    onPress={() => setDraft({ groupType: draft.groupType === g.id ? undefined : g.id })}
                  />
                ))}
              </View>
            </View>

            {/* Horario de inicio del día (#8) */}
            <View style={{ gap: Spacing.two }}>
              <Label>¿A qué hora arrancás el día?</Label>
              {DAY_STARTS.map((o) => {
                const sel = (draft.dayStartMin ?? 9 * 60) === o.min;
                return (
                  <Pressable key={o.min} accessibilityRole="button" accessibilityState={{ selected: sel }} onPress={() => setDraft({ dayStartMin: o.min })}>
                    <Card style={[styles.paceCard, sel && { borderColor: t.primary, borderWidth: 2 }]}>
                      <View style={[styles.paceIcon, { backgroundColor: sel ? t.primary : t.primarySoft }]}>
                        <Ionicons name={o.icon} size={20} color={sel ? t.textOnPrimary : t.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Body style={{ fontWeight: '700', fontSize: 16 }}>{o.label}</Body>
                        <Body muted style={{ fontSize: 13 }}>{o.sub}</Body>
                      </View>
                      {sel && <Ionicons name="checkmark-circle" size={22} color={t.primary} />}
                    </Card>
                  </Pressable>
                );
              })}
              <TimeField
                label="Horario personalizado"
                value={draft.dayStartMin}
                placeholder="Ej. 08:45"
                onChange={(value) => setDraft({ dayStartMin: value })}
              />
            </View>
          </>
        )}

        {/* ---------- Paso 6: Presupuesto ---------- */}
        {step === 5 && (
          <>
            <StepIntro icon="wallet-outline" title="¿Qué presupuesto manejás?" description="Una referencia diaria para equilibrar comidas y actividades. No pedimos datos financieros." />
            {BUDGETS.map((b) => {
              const sel = draft.budget === b.id;
              const currency = CITY_CURRENCY[draft.cityId ?? ''] ?? 'USD';
              const range =
                b.id === 'noindica'
                  ? null
                  : REMOTE_CONFIG.budgetByCurrency[currency][b.id];
              const fmtMoney = (value: number) =>
                new Intl.NumberFormat('es', {
                  style: 'currency',
                  currency,
                  maximumFractionDigits: 0,
                }).format(value);
              return (
                <Pressable
                  key={b.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sel }}
                  onPress={() => setDraft({ budget: b.id as Budget })}>
                  <Card style={[styles.budgetCard, sel && { borderColor: t.primary, borderWidth: 2 }]}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.budgetHeading}>
                        <Body style={{ fontWeight: '900', fontSize: 16 }}>{b.label}</Body>
                        {range && (
                          <View style={[styles.budgetRange, { backgroundColor: sel ? t.primarySoft : t.background }]}>
                            <Body style={{ color: sel ? t.primaryStrong : t.text, fontSize: 12, fontWeight: '900' }}>
                              {fmtMoney(range[0])}–{fmtMoney(range[1])} / día
                            </Body>
                          </View>
                        )}
                      </View>
                      <Body muted style={{ fontSize: 13 }}>
                        {b.desc}
                      </Body>
                      <Body style={{ fontSize: 12, marginTop: 7, lineHeight: 17 }}>{b.includes}</Body>
                    </View>
                    {sel && <Ionicons name="checkmark-circle" size={22} color={t.primary} />}
                  </Card>
                </Pressable>
              );
            })}
            <View style={[styles.budgetNotice, { backgroundColor: t.secondarySoft }]}>
              <Ionicons name="information-circle-outline" size={19} color={t.secondary} />
              <Body style={{ flex: 1, color: t.secondary, fontSize: 12 }}>
                Referencias por persona. No incluyen alojamiento ni transporte de llegada al destino.
              </Body>
            </View>
          </>
        )}

        {/* ---------- Paso 7: Imprescindibles ---------- */}
        {step === 6 && (
          <>
            <StepIntro icon="star-outline" title="¿Qué no te querés perder?" description="Buscá y marcá tus imprescindibles. Permanecerán protegidos al reorganizar el viaje." optional />
            <View style={[styles.search, { backgroundColor: t.surface, borderColor: t.border }]}>
              <Ionicons name="search" size={19} color={t.textSecondary} />
              <TextInput
                accessibilityLabel="Buscar lugares imprescindibles"
                value={mustQuery}
                onChangeText={setMustQuery}
                placeholder="Buscar museo, monumento o restaurante"
                placeholderTextColor={t.textSecondary}
                style={{ flex: 1, color: t.text, fontSize: 15 }}
              />
              {mustQuery.length > 0 && (
                <Pressable accessibilityLabel="Limpiar búsqueda" hitSlop={8} onPress={() => setMustQuery('')}>
                  <Ionicons name="close-circle" size={20} color={t.textSecondary} />
                </Pressable>
              )}
            </View>
            {draft.mustSeeIds.length > 0 && (
              <View style={styles.selectedMust}>
                <Body style={{ fontWeight: '900' }}>{draft.mustSeeIds.length} seleccionados</Body>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
                  {draft.mustSeeIds.map((id) => {
                    const place = cityPlaces.find((candidate) => candidate.id === id);
                    if (!place) return null;
                    return (
                    <Pressable
                      key={id}
                      accessibilityRole="button"
                      accessibilityLabel={`Quitar ${place.name}`}
                      onPress={() => toggleMustSee(id)}
                        style={[styles.selectedPlace, { backgroundColor: t.primarySoft }]}>
                        <Body numberOfLines={1} style={{ color: t.primaryStrong, fontWeight: '800', fontSize: 12, maxWidth: 160 }}>
                          {place.name}
                        </Body>
                        <Ionicons name="close" size={16} color={t.primaryStrong} />
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}
            <View style={[styles.catalogInfo, { backgroundColor: t.secondarySoft }]}>
              <Ionicons
                name={catalogStatus === 'loading' ? 'sync-outline' : 'location-outline'}
                size={19}
                color={t.secondary}
              />
              <Body style={{ flex: 1, color: t.secondary, fontSize: 12, fontWeight: '700' }}>
                {catalogStatus === 'loading'
                  ? 'Descubriendo más lugares de la ciudad…'
                  : `${cityPlaces.length} lugares disponibles para personalizar tu viaje`}
              </Body>
            </View>
            <View style={[styles.eventNotice, { backgroundColor: t.surface, borderColor: t.border }]}>
              <Ionicons name="calendar-outline" size={20} color={eventStatus === 'ready' ? t.secondary : t.textSecondary} />
              <View style={{ flex: 1 }}>
                <Body style={{ fontWeight: '800' }}>
                  {eventStatus === 'loading' ? 'Buscando eventos para tus fechas…' : eventStatus === 'ready' ? 'Eventos de tus fechas incluidos' : 'Eventos durante el viaje'}
                </Body>
                <Body muted style={{ fontSize: 12 }}>
                  {eventStatus === 'unconfigured'
                    ? 'Se activarán al configurar el proveedor de eventos.'
                    : eventStatus === 'error'
                      ? 'No pudimos consultar eventos. El resto del itinerario seguirá funcionando.'
                      : 'Partidos, conciertos y festivales se fijan en su fecha y horario real.'}
                </Body>
              </View>
            </View>
            <View style={{ gap: Spacing.two }}>
              {cityPlaces
                .filter((p) => !p.isMeal)
                .filter((p) =>
                  !mustQuery.trim() ||
                  `${p.name} ${p.zone} ${p.address ?? ''}`.toLowerCase().includes(mustQuery.trim().toLowerCase()),
                )
                .sort((a, b) => b.rating - a.rating)
                .slice(0, mustQuery.trim() ? 30 : 18)
                .map((p) => {
                  const sel = draft.mustSeeIds.includes(p.id);
                  return (
                    <Pressable
                      key={p.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${sel ? 'Quitar' : 'Agregar'} ${p.name} como imprescindible`}
                      accessibilityState={{ selected: sel }}
                      onPress={() => toggleMustSee(p.id)}>
                      <Card style={[styles.mustRow, sel && { borderColor: t.primary }]}>
                        <View style={{ flex: 1 }}>
                          <Body style={{ fontWeight: '600' }}>{p.name}</Body>
                          <Body muted style={{ fontSize: 12 }}>
                            {CATEGORY_LABEL[p.categories[0]]} · {p.address ?? p.zone}
                          </Body>
                        </View>
                        <Ionicons
                          name={sel ? 'star' : 'star-outline'}
                          size={22}
                          color={sel ? t.warning : t.textSecondary}
                        />
                      </Card>
                    </Pressable>
                  );
                })}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowManual((value) => !value)}
              style={[styles.manualToggle, { borderColor: t.border, backgroundColor: t.surface }]}>
              <Ionicons name="link-outline" size={20} color={t.primary} />
              <View style={{ flex: 1 }}>
                <Body style={{ fontWeight: '800' }}>Agregar dirección o enlace</Body>
                <Body muted style={{ fontSize: 12 }}>Para ese lugar que todavía no aparece</Body>
              </View>
              <Ionicons name={showManual ? 'chevron-up' : 'chevron-down'} size={18} color={t.textSecondary} />
            </Pressable>
            {showManual && (
              <View style={[styles.manualForm, { backgroundColor: t.surface, borderColor: t.border }]}>
                <TextInput
                  accessibilityLabel="Nombre del lugar"
                  value={manualName}
                  onChangeText={setManualName}
                  placeholder="Nombre del lugar"
                  placeholderTextColor={t.textSecondary}
                  style={[styles.manualInput, { color: t.text, borderColor: t.border }]}
                />
                <TextInput
                  accessibilityLabel="Dirección o enlace"
                  value={manualReference}
                  onChangeText={setManualReference}
                  placeholder="Dirección o https://…"
                  placeholderTextColor={t.textSecondary}
                  autoCapitalize="none"
                  style={[styles.manualInput, { color: t.text, borderColor: t.border }]}
                />
                <Body muted style={{ fontSize: 11 }}>
                  Los enlaces de Google Maps con coordenadas se ubican automáticamente. Las direcciones escritas quedan marcadas para verificar.
                </Body>
                <Button
                  title="Agregar como imprescindible"
                  icon="star-outline"
                  size="md"
                  disabled={!manualName.trim()}
                  onPress={() => {
                    addManualMustSee({
                      name: manualName,
                      address: manualReference.startsWith('http') ? undefined : manualReference,
                      url: manualReference.startsWith('http') ? manualReference : undefined,
                    });
                    setManualName('');
                    setManualReference('');
                    setShowManual(false);
                  }}
                />
              </View>
            )}
          </>
        )}

        {/* ---------- Paso 8: Revisión ---------- */}
        {step === 7 && <ReviewStep onEdit={(target) => { direction.current = target < step ? -1 : 1; setStep(target); }} />}
        </Animated.View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: t.surface, borderTopColor: t.border }]}>
        <View style={styles.footerInner}>
          <View style={styles.footerMeta}>
            <View style={[styles.savedDot, { backgroundColor: t.secondary }]} />
            <Body muted style={{ fontSize: 11, fontWeight: '700' }}>Tus respuestas se guardan automáticamente</Body>
          </View>
          <Button
            title={STEP_ACTIONS[step]}
            icon={step === TOTAL - 1 ? 'sparkles' : 'arrow-forward'}
            disabled={!canContinue()}
            onPress={next}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const TRAVEL_POINTS: { id: TravelPointType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'aeropuerto', label: 'Aeropuerto', icon: 'airplane-outline' },
  { id: 'estacion', label: 'Estación', icon: 'train-outline' },
  { id: 'terminal', label: 'Terminal', icon: 'bus-outline' },
  { id: 'puerto', label: 'Puerto', icon: 'boat-outline' },
  { id: 'direccion', label: 'Dirección', icon: 'location-outline' },
  { id: 'otro', label: 'Otro', icon: 'ellipsis-horizontal-outline' },
];

function formatTime(value?: number) {
  if (value == null) return '';
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function TimeField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value?: number;
  placeholder?: string;
  onChange: (value?: number) => void;
}) {
  const t = useTheme();
  const [text, setText] = useState(formatTime(value));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setText(formatTime(value)), [value]);
  const commit = () => {
    if (!text.trim()) {
      setError(null);
      onChange(undefined);
      return;
    }
    const match = text.trim().match(/^(\d{1,2}):(\d{2})$/);
    const hours = Number(match?.[1]);
    const minutes = Number(match?.[2]);
    if (!match || hours > 23 || minutes > 59) {
      setError('Usá el formato HH:MM.');
      return;
    }
    setError(null);
    onChange(hours * 60 + minutes);
    setText(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
  };
  return (
    <View style={{ flex: 1, minWidth: 126, gap: 6 }}>
      <Label>{label}</Label>
      <View style={[styles.inlineField, { backgroundColor: t.surface, borderColor: error ? t.error : t.border }]}>
        <Ionicons name="time-outline" size={18} color={error ? t.error : t.textSecondary} />
        <TextInput
          accessibilityLabel={label}
          value={text}
          onChangeText={setText}
          onBlur={commit}
          onSubmitEditing={commit}
          placeholder={placeholder ?? '09:00'}
          placeholderTextColor={t.textSecondary}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
          style={[styles.inlineInput, { color: t.text }]}
        />
      </View>
      {error && <Body style={{ color: t.error, fontSize: 11 }}>{error}</Body>}
    </View>
  );
}

function TravelBoundaryEditor({
  kind,
  draft,
  setDraft,
}: {
  kind: 'arrival' | 'departure';
  draft: Draft;
  setDraft: (partial: Partial<Draft>) => void;
}) {
  const t = useTheme();
  const arrival = kind === 'arrival';
  const title = arrival ? 'Llegada al destino' : 'Salida del destino';
  const time = arrival ? draft.arrivalTime : draft.departureTime;
  const point = arrival ? draft.arrivalPlace : draft.departurePlace;
  const pointType = arrival ? draft.arrivalType : draft.departureType;
  const buffer = arrival ? draft.arrivalBufferMin ?? 75 : draft.departureLeadMin ?? 120;
  const transfer = arrival ? draft.arrivalTransferMin ?? 45 : draft.departureTransferMin ?? 45;
  return (
    <Card style={styles.boundaryCard}>
      <View style={styles.boundaryHeading}>
        <View style={[styles.boundaryIcon, { backgroundColor: arrival ? t.primarySoft : t.secondarySoft }]}>
          <Ionicons name={arrival ? 'airplane-outline' : 'navigate-outline'} size={21} color={arrival ? t.primary : t.secondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Body style={{ fontWeight: '900', fontSize: 16 }}>{title}</Body>
          <Body muted style={{ fontSize: 12 }}>
            {arrival ? 'Dejamos margen para equipaje, traslado y descanso.' : 'Protegemos el traslado y la anticipación necesaria.'}
          </Body>
        </View>
      </View>

      <View style={styles.twoColumns}>
        <TimeField
          label={arrival ? 'Hora de llegada' : 'Hora de salida'}
          value={time}
          onChange={(value) => setDraft(arrival ? { arrivalTime: value } : { departureTime: value })}
        />
        <TimeField
          label={arrival ? 'Check-in' : 'Check-out'}
          value={arrival ? draft.checkInTime : draft.checkOutTime}
          onChange={(value) => setDraft(arrival ? { checkInTime: value } : { checkOutTime: value })}
        />
      </View>

      <View style={{ gap: 7 }}>
        <Label>Lugar</Label>
        <View style={styles.chips}>
          {TRAVEL_POINTS.map((option) => (
            <Chip
              key={option.id}
              label={option.label}
              icon={option.icon}
              selected={pointType === option.id}
              onPress={() => setDraft(arrival ? { arrivalType: option.id } : { departureType: option.id })}
            />
          ))}
        </View>
        <View style={[styles.inlineField, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Ionicons name="location-outline" size={18} color={t.textSecondary} />
          <TextInput
            accessibilityLabel={arrival ? 'Lugar de llegada' : 'Lugar de salida'}
            value={point ?? ''}
            onChangeText={(value) => setDraft(arrival ? { arrivalPlace: value } : { departurePlace: value })}
            placeholder={arrival ? 'Ej. Aeropuerto Fiumicino' : 'Ej. Estación Termini'}
            placeholderTextColor={t.textSecondary}
            style={[styles.inlineInput, { color: t.text }]}
          />
        </View>
      </View>

      <View style={styles.boundaryOptions}>
        <View style={{ flex: 1, minWidth: 150, gap: 6 }}>
          <Label>{arrival ? 'Margen al llegar' : 'Anticipación de salida'}</Label>
          <View style={styles.chips}>
            {(arrival ? [45, 75, 120] : [90, 120, 180]).map((minutes) => (
              <Chip
                key={minutes}
                label={`${minutes} min`}
                selected={buffer === minutes}
                onPress={() => setDraft(arrival ? { arrivalBufferMin: minutes } : { departureLeadMin: minutes })}
              />
            ))}
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 150, gap: 6 }}>
          <Label>Traslado estimado</Label>
          <View style={styles.chips}>
            {[30, 45, 60].map((minutes) => (
              <Chip
                key={minutes}
                label={`${minutes} min`}
                selected={transfer === minutes}
                onPress={() => setDraft(arrival ? { arrivalTransferMin: minutes } : { departureTransferMin: minutes })}
              />
            ))}
          </View>
        </View>
      </View>

      {arrival && (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: draft.canLeaveLuggage === true }}
          onPress={() => setDraft({ canLeaveLuggage: !draft.canLeaveLuggage })}
          style={[styles.luggageOption, { backgroundColor: draft.canLeaveLuggage ? t.secondarySoft : t.backgroundElement }]}>
          <Ionicons name={draft.canLeaveLuggage ? 'checkbox' : 'square-outline'} size={21} color={draft.canLeaveLuggage ? t.secondary : t.textSecondary} />
          <Body style={{ flex: 1, fontWeight: '700' }}>Puedo dejar el equipaje antes del check-in</Body>
        </Pressable>
      )}
    </Card>
  );
}

function ReviewStep({ onEdit }: { onEdit: (step: number) => void }) {
  const t = useTheme();
  const draft = useStore((s) => s.draft);
  const rows: { step: number; label: string; value: string }[] = [
    { step: 0, label: 'Destino', value: draft.cityName ? `${draft.cityName}, ${draft.country}` : '—' },
    {
      step: 1,
      label: 'Fechas',
      value:
        draft.startDate && draft.endDate
          ? `${fmtRange(draft.startDate, draft.endDate)} · ${daysInclusive(draft.startDate, draft.endDate)} días`
          : '—',
    },
    { step: 2, label: 'Alojamiento', value: draft.accommodation?.name ?? 'Sin definir' },
    {
      step: 3,
      label: 'Intereses',
      value: draft.interests.length ? draft.interests.map((i) => CATEGORY_LABEL[i]).join(', ') : '—',
    },
    { step: 4, label: 'Ritmo', value: PACES.find((p) => p.id === draft.pace)?.label ?? '' },
    {
      step: 4,
      label: 'Viajeros y comienzo',
      value: `${draft.partySize ?? 1} persona(s) · desde ${formatTime(draft.dayStartMin ?? 9 * 60)}`,
    },
    {
      step: 1,
      label: 'Llegada y salida',
      value: `${draft.arrivalTime != null ? formatTime(draft.arrivalTime) : 'Sin hora'} → ${draft.departureTime != null ? formatTime(draft.departureTime) : 'Sin hora'}`,
    },
    { step: 5, label: 'Presupuesto', value: BUDGETS.find((b) => b.id === draft.budget)?.label ?? '' },
    { step: 6, label: 'Imprescindibles', value: draft.mustSeeIds.length ? `${draft.mustSeeIds.length} lugar(es)` : 'Ninguno' },
  ];
  return (
    <>
      <StepIntro icon="checkmark-circle-outline" title="Todo listo para organizarlo" description="Revisá los datos. Podés volver a cualquier sección sin perder lo ingresado." />
      <Card style={{ padding: 0 }}>
        {rows.map((r, i) => (
          <Pressable
            key={r.label}
            accessibilityRole="button"
            accessibilityLabel={`Editar ${r.label}`}
            onPress={() => onEdit(r.step)}
            style={[styles.reviewRow, i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: t.border }]}>
            <View style={{ flex: 1 }}>
              <Label>{r.label}</Label>
              <Body style={{ marginTop: 2 }}>{r.value}</Body>
            </View>
            <Ionicons name="pencil" size={16} color={t.textSecondary} />
          </Pressable>
        ))}
      </Card>
    </>
  );
}

function StepIntro({
  icon,
  title,
  description,
  optional,
}: {
  icon: any;
  title: string;
  description: string;
  optional?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={styles.stepIntro}>
      <View style={[styles.stepIcon, { backgroundColor: t.primarySoft }]}>
        <Ionicons name={icon} size={23} color={t.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.stepTitleRow}>
          <H1 style={styles.stepTitle}>{title}</H1>
          {optional && (
            <View style={[styles.optionalBadge, { backgroundColor: t.backgroundElement }]}>
              <Body muted style={{ fontSize: 11, fontWeight: '800' }}>Opcional</Body>
            </View>
          )}
        </View>
        <Body muted style={styles.stepDescription}>{description}</Body>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flowContent: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  stepStage: { gap: Spacing.three },
  routePreview: { borderRadius: Radius.lg, padding: 14, gap: 12, overflow: 'hidden' },
  routePreviewCopy: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  stepIntro: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: Spacing.one },
  stepIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stepTitleRow: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 },
  stepTitle: { flexShrink: 1, fontSize: 27, lineHeight: 32 },
  stepDescription: { marginTop: 5, maxWidth: 580 },
  optionalBadge: { minHeight: 28, justifyContent: 'center', paddingHorizontal: 9, borderRadius: Radius.pill },
  catalogInfo: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
  },
  selectedMust: { gap: 8 },
  selectedPlace: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: Radius.pill, paddingHorizontal: 11 },
  manualToggle: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: Spacing.three, borderWidth: 1, borderRadius: Radius.md },
  manualForm: { gap: Spacing.two, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.three },
  manualInput: { minHeight: 50, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 13, fontSize: 15 },
  budgetCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  budgetHeading: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  budgetRange: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: Radius.pill },
  budgetNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: Spacing.three, borderRadius: Radius.md },
  search: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.three, paddingVertical: 12 },
  cityCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 1.5, borderRadius: Radius.lg, padding: Spacing.two, paddingRight: Spacing.three },
  cityThumb: { width: 56, height: 56, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  rangeInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  paceCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  paceIcon: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  mustRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three },
  footer: { padding: Spacing.three, paddingTop: Spacing.two, borderTopWidth: 1, marginBottom: TAB_BAR_HEIGHT },
  footerInner: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: 8 },
  footerMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  savedDot: { width: 6, height: 6, borderRadius: 3 },
  boundaryCard: { gap: Spacing.three },
  boundaryHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  boundaryIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  twoColumns: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  inlineField: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: Radius.md, paddingHorizontal: 13 },
  inlineInput: { flex: 1, minWidth: 0, minHeight: 46, fontSize: 16 },
  boundaryOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  luggageOption: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: Spacing.three, borderRadius: Radius.md },
  eventNotice: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.three },
  hotelSearch: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingLeft: Spacing.three,
    paddingRight: 6,
  },
  searchHotelButton: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hotelResult: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  hotelConfirmed: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
  },
});
