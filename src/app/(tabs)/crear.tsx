import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TAB_BAR_HEIGHT } from '@/components/app-tabs';
import { Calendar } from '@/components/calendar';
import { CityImage } from '@/components/city-image';
import { ProgressBar, TopBar } from '@/components/flow-ui';
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
import type { Accommodation, Budget } from '@/types';

const TOTAL = 8;

export default function CrearScreen() {
  const t = useTheme();
  const router = useRouter();
  const draft = useStore((s) => s.draft);
  const setDraft = useStore((s) => s.setDraft);
  const toggleInterest = useStore((s) => s.toggleInterest);
  const toggleMustSee = useStore((s) => s.toggleMustSee);
  const setAccommodation = useStore((s) => s.setAccommodation);
  const loadCityCatalog = useStore((s) => s.loadCityCatalog);
  const catalogStatus = useStore((s) => (s.draft.cityId ? s.catalogStatus[s.draft.cityId] : 'idle'));
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

  const cityPlaces = draft.cityId ? placesByCity(draft.cityId) : [];
  const zones = useMemo(() => Array.from(new Set(cityPlaces.map((p) => p.zone))), [draft.cityId]);
  const filteredCities = CITIES.filter(
    (c) => !query || `${c.name} ${c.country}`.toLowerCase().includes(query.toLowerCase()),
  );

  const canContinue = () => {
    if (step === 0) return !!draft.cityId;
    if (step === 1) return !!draft.startDate && !!draft.endDate;
    if (step === 2 && accChoice === 'yes') return Boolean(draft.accommodation);
    if (step === 3) return draft.interests.length > 0;
    return true;
  };

  const back = () => (step === 0 ? router.push('/') : setStep((s) => s - 1));
  const next = () => {
    if (step < TOTAL - 1) setStep((s) => s + 1);
    else router.push('/generando');
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
      <TopBar onBack={back} title={`Paso ${step + 1} de ${TOTAL}`} />
      <ProgressBar step={step} total={TOTAL} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: Spacing.three, gap: Spacing.three, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled">
        {/* ---------- Paso 1: Destino ---------- */}
        {step === 0 && (
          <>
            <H1>¿A dónde vas?</H1>
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
            <H1>¿Cuándo viajás?</H1>
            <Calendar
              start={draft.startDate}
              end={draft.endDate}
              onChange={(s, e) => setDraft({ startDate: s, endDate: e })}
            />
            {draft.startDate && draft.endDate && (
              <Card style={styles.rangeInfo}>
                <Ionicons name="calendar" size={20} color={t.secondary} />
                <Body style={{ fontWeight: '700' }}>
                  {fmtRange(draft.startDate, draft.endDate)} ·{' '}
                  {daysInclusive(draft.startDate, draft.endDate)} días
                </Body>
              </Card>
            )}
          </>
        )}

        {/* ---------- Paso 3: Alojamiento ---------- */}
        {step === 2 && (
          <>
            <H1>¿Dónde te vas a alojar?</H1>
            <Body muted>Es opcional. Nos sirve para armar recorridos que empiecen cerca tuyo.</Body>
            {[
              { id: 'yes', label: 'Ya tengo alojamiento', icon: 'bed' },
              { id: 'no', label: 'Todavía no lo decidí', icon: 'help-circle' },
              { id: 'later', label: 'Lo agrego después', icon: 'time' },
            ].map((o) => {
              const sel = accChoice === o.id;
              return (
                <Pressable
                  key={o.id}
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
            <H1>¿Qué te gusta hacer?</H1>
            <Body muted>Elegí todo lo que te interese. Mientras más nos cuentes, mejor el plan.</Body>
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
            <H1>¿A qué ritmo?</H1>
            {PACES.map((p) => {
              const sel = draft.pace === p.id;
              return (
                <Pressable key={p.id} onPress={() => setDraft({ pace: p.id })}>
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
          </>
        )}

        {/* ---------- Paso 6: Presupuesto ---------- */}
        {step === 5 && (
          <>
            <H1>¿Qué presupuesto manejás?</H1>
            <Body muted>Lo usamos para ajustar restaurantes y actividades. No pedimos datos financieros.</Body>
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
                <Pressable key={b.id} onPress={() => setDraft({ budget: b.id as Budget })}>
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
            <H1>¿Algún lugar imprescindible?</H1>
            <Body muted>Marcá los que no te querés perder. Los vamos a respetar siempre. (Opcional)</Body>
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
                    <Pressable key={p.id} onPress={() => toggleMustSee(p.id)}>
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
        {step === 7 && <ReviewStep onEdit={setStep} />}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: t.surface, borderTopColor: t.border }]}>
        <Button
          title={step === TOTAL - 1 ? 'Crear mi itinerario' : 'Continuar'}
          icon={step === TOTAL - 1 ? 'sparkles' : 'arrow-forward'}
          disabled={!canContinue()}
          onPress={next}
        />
      </View>
    </SafeAreaView>
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
    { step: 5, label: 'Presupuesto', value: BUDGETS.find((b) => b.id === draft.budget)?.label ?? '' },
    { step: 6, label: 'Imprescindibles', value: draft.mustSeeIds.length ? `${draft.mustSeeIds.length} lugar(es)` : 'Ninguno' },
  ];
  return (
    <>
      <H1>Revisá tu viaje</H1>
      <Body muted>Tocá cualquier fila para editarla.</Body>
      <Card style={{ padding: 0 }}>
        {rows.map((r, i) => (
          <Pressable
            key={r.label}
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

const styles = StyleSheet.create({
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
