import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useState, type ComponentProps } from 'react';

import { Sheet } from '@/components/sheet';
import { Body, Button, Card, H2, Label } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { cityById } from '@/data/cities';
import { placeById } from '@/data/places';
import { useTheme } from '@/hooks/use-theme';
import { purchaseUrlFor } from '@/lib/commerce';
import { fmtDate } from '@/lib/dates';
import { geocodeAccommodation, type GeocodedAccommodation } from '@/lib/place-provider';
import { transportOptions } from '@/lib/transport';
import { ticketInfo } from '@/lib/tickets';
import { useStore } from '@/store/useStore';
import type { Activity, Place, Trip } from '@/types';

export function TicketsTab({
  trip,
  onOpenActivity,
}: {
  trip: Trip;
  onOpenActivity: (activity: Activity) => void;
}) {
  const t = useTheme();
  const removeTicket = useStore((state) => state.removeTicket);
  const tickets = trip.tickets ?? [];
  const activities = trip.days.flatMap((day) => day.activities);
  const reservations = activities.filter((activity) => {
    const place = placeById(activity.placeId);
    return place && (place.price > 0 || place.needsBooking);
  });

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
            Abrí una actividad paga, comprá en el sitio oficial y guardá acá el enlace o código.
          </Body>
        </View>
      ) : (
        <View style={{ gap: Spacing.two }}>
          {tickets
            .slice()
            .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
            .map((ticket) => (
              <View key={ticket.id} style={[styles.ticketCard, { backgroundColor: t.surface }]}>
                <View style={[styles.ticketStripe, { backgroundColor: t.primary }]} />
                <View style={styles.ticketBody}>
                  <View style={styles.ticketHeading}>
                    <View style={[styles.ticketGlyph, { backgroundColor: t.primarySoft }]}>
                      <Ionicons name="ticket" size={21} color={t.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Body style={{ fontWeight: '900', fontSize: 16 }}>{ticket.title}</Body>
                      <Body muted style={{ fontSize: 12 }}>
                        {ticket.date ? fmtDate(ticket.date) : trip.cityName}
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
                    {ticket.activityId && (
                      <Button
                        title="Ver actividad"
                        icon="location-outline"
                        size="md"
                        variant="ghost"
                        onPress={() => {
                          const activity = activities.find((item) => item.id === ticket.activityId);
                          if (activity) onOpenActivity(activity);
                        }}
                        style={{ flex: 1 }}
                      />
                    )}
                  </View>
                </View>
              </View>
            ))}
        </View>
      )}

      <View style={{ gap: Spacing.two }}>
        <H2>Actividades para reservar</H2>
        {reservations.map((activity) => {
          const place = placeById(activity.placeId);
          const saved = tickets.some((ticket) => ticket.activityId === activity.id);
          if (!place) return null;
          return (
            <Pressable key={activity.id} onPress={() => onOpenActivity(activity)}>
              <Card style={styles.row}>
                <Ionicons
                  name={saved ? 'checkmark-circle' : 'ticket-outline'}
                  size={21}
                  color={saved ? t.secondary : t.primary}
                />
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: '700' }}>{place.name}</Body>
                  <Body muted style={{ fontSize: 12 }}>
                    {saved ? 'Ticket guardado' : purchaseUrlFor(place) ? 'Compra oficial disponible' : 'Agregar confirmación'}
                  </Body>
                </View>
                <Ionicons name="chevron-forward" size={17} color={t.textSecondary} />
              </Card>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

export function TransportSheet({
  cityId,
  leg,
  onClose,
}: {
  cityId: string;
  leg: { from: Place; to: Place } | null;
  onClose: () => void;
}) {
  const t = useTheme();
  const options = leg ? transportOptions(cityId, leg.from, leg.to) : [];
  return (
    <Sheet visible={Boolean(leg)} onClose={onClose} title={leg ? `${leg.from.name} → ${leg.to.name}` : 'Cómo llegar'}>
      <Body muted style={{ marginBottom: Spacing.three }}>
        Compará estimaciones. Al abrir la ruta vas a ver paradas, líneas, frecuencia y tráfico en tiempo real.
      </Body>
      <View style={{ gap: Spacing.two }}>
        {options.map((option) => (
          <Pressable key={option.mode} onPress={() => Linking.openURL(option.directionsUrl)}>
            <Card style={[styles.transportOption, option.recommended && { borderColor: t.secondary, borderWidth: 2 }]}>
              <View style={[styles.transportIcon, { backgroundColor: option.recommended ? t.secondary : t.secondarySoft }]}>
                <Ionicons name={option.icon} size={22} color={option.recommended ? '#fff' : t.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.optionHeading}>
                  <Body style={{ fontWeight: '900' }}>{option.label}</Body>
                  {option.recommended && (
                    <View style={[styles.tag, { backgroundColor: `${t.secondary}22` }]}>
                      <Body style={{ color: t.secondary, fontSize: 11, fontWeight: '800' }}>Recomendado</Body>
                    </View>
                  )}
                </View>
                <Body muted style={{ fontSize: 12, marginTop: 2 }}>{option.detail}</Body>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Body style={{ fontWeight: '900', fontSize: 17 }}>{option.minutes} min</Body>
                <Ionicons name="open-outline" size={16} color={t.textSecondary} />
              </View>
            </Card>
          </Pressable>
        ))}
      </View>
      <View style={[styles.notice, { backgroundColor: t.backgroundElement }]}>
        <Ionicons name="information-circle-outline" size={19} color={t.textSecondary} />
        <Body muted style={{ flex: 1, fontSize: 12 }}>
          Rumbo no inventa líneas ni horarios: la ruta externa completa la información actualizada del operador local.
        </Body>
      </View>
    </Sheet>
  );
}

export function TicketEditorSheet({
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
  const addTicket = useStore((state) => state.addTicket);
  const place = activity ? placeById(activity.placeId) : undefined;
  const [provider, setProvider] = useState('');
  const [code, setCode] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');
  const [note, setNote] = useState('');
  const [attachment, setAttachment] = useState<{ uri: string; name: string } | null>(null);
  if (!activity || !place) return <Sheet visible={false} onClose={onClose}>{null}</Sheet>;
  const purchaseUrl = purchaseUrlFor(place);
  const info = ticketInfo(place);
  const day = trip.days.find((item) => item.activities.some((candidate) => candidate.id === activity.id));

  const save = () => {
    addTicket(trip.id, {
      activityId: activity.id,
      placeId: place.id,
      title: place.name,
      provider: provider.trim() || undefined,
      confirmationCode: code.trim() || undefined,
      ticketUrl: ticketUrl.trim() || undefined,
      purchaseUrl,
      kind: info.reservation ? 'reservation' : 'ticket',
      note: note.trim() || undefined,
      attachmentUri: attachment?.uri,
      date: day?.date,
    });
    setProvider('');
    setCode('');
    setTicketUrl('');
    setNote('');
    setAttachment(null);
    onSaved();
  };

  return (
    <Sheet visible={Boolean(activity)} onClose={onClose} title={`${info.reservation ? 'Reserva' : 'Ticket'} · ${place.name}`}>
      {purchaseUrl && (
        <Pressable onPress={() => Linking.openURL(purchaseUrl)} style={[styles.purchase, { backgroundColor: t.secondarySoft }]}>
          <View style={[styles.purchaseIcon, { backgroundColor: t.secondary }]}>
            <Ionicons name="shield-checkmark-outline" size={21} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Body style={{ color: t.secondary, fontWeight: '900' }}>Comprar en el sitio oficial</Body>
            <Body style={{ color: t.secondary, fontSize: 12 }}>Se abre fuera de Rumbo</Body>
          </View>
          <Ionicons name="open-outline" size={20} color={t.secondary} />
        </Pressable>
      )}
      <Body muted style={{ marginVertical: Spacing.three }}>
        Después de comprar, guardá lo importante. Rumbo no procesa pagos ni almacena información bancaria.
      </Body>
      <FormField label="Proveedor o plataforma" value={provider} onChangeText={setProvider} placeholder="Ej. sitio oficial" />
      <FormField label="Código de confirmación" value={code} onChangeText={setCode} placeholder="Ej. ROMA-84K2" autoCapitalize="characters" />
      <FormField label="Enlace al ticket o PDF" value={ticketUrl} onChangeText={setTicketUrl} placeholder="https://…" keyboardType="url" autoCapitalize="none" />
      <FormField label="Nota" value={note} onChangeText={setNote} placeholder="Indicaciones, horario o titular" multiline />
      <Pressable
        accessibilityRole="button"
        onPress={async () => {
          const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true, multiple: false });
          if (!result.canceled && result.assets[0]) setAttachment({ uri: result.assets[0].uri, name: result.assets[0].name });
        }}
        style={[styles.attachButton, { borderColor: attachment ? t.secondary : t.border, backgroundColor: attachment ? t.secondarySoft : t.surface }]}>
        <Ionicons name={attachment ? 'checkmark-circle' : 'attach-outline'} size={20} color={attachment ? t.secondary : t.textSecondary} />
        <Body style={{ flex: 1, fontWeight: '800', color: attachment ? t.secondary : t.text }} numberOfLines={1}>
          {attachment?.name ?? 'Adjuntar PDF o imagen'}
        </Body>
      </Pressable>
      <Button
        title={info.reservation ? 'Guardar reserva' : 'Guardar en mi viaje'}
        icon={info.reservation ? 'calendar' : 'ticket'}
        onPress={save}
        disabled={!code.trim() && !ticketUrl.trim() && !note.trim() && !attachment}
        style={{ marginTop: Spacing.four }}
      />
    </Sheet>
  );
}

export function AccommodationSheet({
  trip,
  visible,
  onClose,
  onSaved,
}: {
  trip: Trip;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTheme();
  const city = cityById(trip.cityId);
  const updateAccommodation = useStore((state) => state.updateTripAccommodation);
  const [query, setQuery] = useState(trip.accommodation?.address ?? '');
  const [results, setResults] = useState<GeocodedAccommodation[]>([]);
  const [selected, setSelected] = useState<GeocodedAccommodation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    if (!city || query.trim().length < 3) return;
    setLoading(true);
    setError(null);
    try {
      const found = await geocodeAccommodation(query.trim(), city);
      setResults(found);
      if (!found.length) setError('No encontramos esa dirección. Probá con calle, número y hotel.');
    } catch {
      setError('No pudimos buscar ahora. Intentá nuevamente con conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Base del viaje">
      <Body muted style={{ marginBottom: Spacing.three }}>
        La usamos para ordenar el primer y último traslado de cada día.
      </Body>
      <View style={[styles.inlineSearch, { borderColor: error ? t.error : t.border }]}>
        <Ionicons name="bed-outline" size={20} color={t.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
          placeholder="Hotel, calle y número"
          placeholderTextColor={t.textSecondary}
          style={{ flex: 1, color: t.text, fontSize: 15 }}
        />
        <Pressable onPress={search} style={[styles.searchButton, { backgroundColor: t.primary }]}>
          <Ionicons name={loading ? 'hourglass-outline' : 'search'} size={19} color="#fff" />
        </Pressable>
      </View>
      {error && <Body style={{ color: t.error, fontSize: 12, marginTop: 8 }}>{error}</Body>}
      <View style={{ gap: Spacing.two, marginTop: Spacing.three }}>
        {results.map((result) => (
          <Pressable key={`${result.lat}-${result.lng}`} onPress={() => setSelected(result)}>
            <Card style={[styles.row, selected === result && { borderColor: t.secondary, borderWidth: 2 }]}>
              <Ionicons name="location-outline" size={20} color={selected === result ? t.secondary : t.textSecondary} />
              <Body style={{ flex: 1, fontSize: 13 }} numberOfLines={3}>{result.address}</Body>
              {selected === result && <Ionicons name="checkmark-circle" size={21} color={t.secondary} />}
            </Card>
          </Pressable>
        ))}
      </View>
      <Button
        title="Usar como base"
        icon="checkmark-circle-outline"
        disabled={!selected}
        onPress={() => {
          if (!selected) return;
          updateAccommodation(trip.id, {
            name: selected.name,
            address: selected.address,
            lat: selected.lat,
            lng: selected.lng,
          });
          onSaved();
        }}
        style={{ marginTop: Spacing.four }}
      />
    </Sheet>
  );
}

function FormField({
  label,
  ...props
}: ComponentProps<typeof TextInput> & { label: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6, marginBottom: Spacing.three }}>
      <Label>{label}</Label>
      <TextInput
        {...props}
        placeholderTextColor={t.textSecondary}
        style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.backgroundElement }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  ticketEmpty: { alignItems: 'center', gap: 9, borderRadius: Radius.lg, padding: Spacing.four },
  ticketEmptyIcon: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  ticketCard: { flexDirection: 'row', borderRadius: Radius.lg, overflow: 'hidden' },
  ticketStripe: { width: 7 },
  ticketBody: { flex: 1, padding: Spacing.three, gap: Spacing.three },
  ticketHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  ticketGlyph: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  codeBox: { borderRadius: Radius.md, padding: Spacing.three, gap: 3 },
  ticketActions: { flexDirection: 'row', gap: Spacing.two },
  transportOption: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  transportIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  optionHeading: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill },
  notice: { flexDirection: 'row', gap: 9, marginTop: Spacing.three, padding: Spacing.three, borderRadius: Radius.md },
  purchase: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: Spacing.three, borderRadius: Radius.md },
  purchaseIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  inlineSearch: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: Radius.md, paddingLeft: Spacing.three, paddingRight: 6 },
  searchButton: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 50, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.three, fontSize: 15 },
  attachButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1.5, borderRadius: Radius.md, paddingHorizontal: Spacing.three },
});
