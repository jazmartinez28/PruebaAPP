import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import { CityImage } from '@/components/city-image';
import { BrandMark } from '@/components/brand-mark';
import { Body, Button, Card, H1, H2, Label, Screen } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { CITIES, cityById, type City } from '@/data/cities';
import { useTheme } from '@/hooks/use-theme';
import { daysUntil, fmtRange } from '@/lib/dates';
import { tripStats } from '@/lib/generate';
import { tripStatusOf } from '@/lib/trip';
import { useStore } from '@/store/useStore';
import type { Trip } from '@/types';

const MOODS = [
  { id: 'iconos', label: 'Primera vez', icon: 'camera-outline', interests: ['iconico', 'historia', 'arquitectura'], pace: 'equilibrado', cityIds: ['roma', 'paris', 'nuevayork'] },
  { id: 'sabores', label: 'Comer increíble', icon: 'restaurant-outline', interests: ['gastronomia', 'local'], pace: 'tranquilo', cityIds: ['roma', 'tokio', 'buenosaires'] },
  { id: 'arte', label: 'Arte y diseño', icon: 'color-palette-outline', interests: ['arte', 'museos', 'arquitectura'], pace: 'equilibrado', cityIds: ['paris', 'barcelona', 'tokio'] },
  { id: 'ritmo', label: 'Ciudad con ritmo', icon: 'musical-notes-outline', interests: ['vidanocturna', 'musica', 'local'], pace: 'intenso', cityIds: ['buenosaires', 'nuevayork', 'barcelona'] },
] as const;

export default function HomeScreen() {
  const t = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const trips = useStore((s) => s.trips);
  const user = useStore((s) => s.user);
  const setDraft = useStore((s) => s.setDraft);
  const loadCityCatalog = useStore((s) => s.loadCityCatalog);
  const [mood, setMood] = useState<(typeof MOODS)[number]['id']>('iconos');
  const entrance = useRef(new Animated.Value(0)).current;

  const sorted = useMemo(
    () => [...trips].sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [trips],
  );
  const next = sorted.find((trip) => tripStatusOf(trip) !== 'finalizado') ?? sorted.at(-1);
  const selectedMood = MOODS.find((item) => item.id === mood) ?? MOODS[0];
  const inspiration = selectedMood.cityIds
    .map((id) => cityById(id))
    .filter((city): city is City => Boolean(city));
  const cardWidth = Math.min(width * 0.72, 290);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced) {
        entrance.setValue(1);
        return;
      }
      Animated.timing(entrance, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }).start();
    });
  }, [entrance]);

  const startWithCity = async (city: City) => {
    await Haptics.selectionAsync();
    setDraft({
      cityId: city.id,
      cityName: city.name,
      country: city.country,
      interests: [...selectedMood.interests],
      pace: selectedMood.pace,
    });
    void loadCityCatalog(city.id);
    router.push('/crear');
  };

  const openTripTool = (tab: string, action?: string) => {
    if (!next) return;
    router.push({
      pathname: '/viaje/[id]',
      params: { id: next.id, tab, ...(action ? { action } : {}) },
    });
  };

  const surpriseMe = () => {
    const city = CITIES[Math.floor(Math.random() * CITIES.length)];
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    startWithCity(city);
  };

  return (
    <Screen padded={false}>
      <Animated.View
        style={[
          styles.page,
          {
            opacity: entrance,
            transform: [
              {
                translateY: entrance.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                }),
              },
            ],
          },
        ]}>
        <View style={styles.header}>
          <View>
            <BrandMark />
            <H1 style={styles.greeting}>
              {user ? `Hola, ${user.name.split(' ')[0]}` : 'Tu próximo viaje empieza acá'}
            </H1>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir perfil"
            hitSlop={8}
            onPress={() => router.push('/perfil')}
            style={({ pressed }) => [
              styles.avatar,
              { backgroundColor: t.secondarySoft },
              pressed && styles.pressed,
            ]}>
            <Ionicons name={user ? 'person' : 'person-outline'} size={22} color={t.secondary} />
          </Pressable>
        </View>

        {next ? (
          <NextTripCard
            trip={next}
            onOpen={() => router.push(`/viaje/${next.id}`)}
            onShare={() => router.push({ pathname: '/viaje/[id]', params: { id: next.id, action: 'share' } })}
          />
        ) : (
          <DiscoveryHero onCreate={() => router.push('/crear')} onSurprise={surpriseMe} />
        )}

        {next && (
          <TripCommandCenter
            trip={next}
            onPlan={() => openTripTool('itinerario')}
            onMap={() => openTripTool('mapa')}
            onHotel={() => openTripTool('resumen', 'hotel')}
            onTickets={() => openTripTool('tickets')}
          />
        )}

        <SectionHeader
          title={next ? 'Elegí tu próxima historia' : '¿Qué tipo de viaje necesitás?'}
          action="Ver todos"
          onAction={() => router.push('/crear')}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.moodRail}
          accessibilityRole="tablist">
          {MOODS.map((item) => {
            const selected = item.id === mood;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => {
                  Haptics.selectionAsync();
                  setMood(item.id);
                }}
                style={({ pressed }) => [
                  styles.mood,
                  {
                    backgroundColor: selected ? t.text : t.surface,
                    borderColor: selected ? t.text : t.border,
                  },
                  pressed && styles.pressed,
                ]}>
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={selected ? t.background : t.textSecondary}
                />
                <Body style={{ color: selected ? t.background : t.text, fontWeight: '700' }}>
                  {item.label}
                </Body>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView
          horizontal
          snapToInterval={cardWidth + 12}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.destinationRail}>
          {inspiration.map((city, index) => (
            <DestinationCard
              key={`${mood}-${city.id}`}
              city={city}
              width={cardWidth}
              index={index}
              onPress={() => startWithCity(city)}
            />
          ))}
        </ScrollView>

        <ContextualActions
          trip={next}
          onCreate={() => router.push('/crear')}
          onPlan={() => next && openTripTool('itinerario')}
          onHotel={() => next && openTripTool('resumen', 'hotel')}
          onTickets={() => next && openTripTool('tickets')}
          onPacking={() => next && openTripTool('valija')}
        />

        {!next && <LivePlanPreview />}

        <View style={[styles.promise, { backgroundColor: t.secondarySoft }]}>
          <Ionicons name="shield-checkmark-outline" size={22} color={t.secondary} />
          <View style={{ flex: 1 }}>
            <Body style={{ fontWeight: '800' }}>Un plan completo, no una lista de lugares</Body>
            <Body muted style={{ fontSize: 13, marginTop: 2 }}>
              Organizamos zonas, horarios, traslados y pausas para que el viaje funcione de verdad.
            </Body>
          </View>
        </View>
      </Animated.View>
    </Screen>
  );
}

function DiscoveryHero({
  onCreate,
  onSurprise,
}: {
  onCreate: () => void;
  onSurprise: () => void;
}) {
  const city = cityById('roma');
  return (
    <CityImage city={city} scrim={0.43} style={styles.hero}>
      <View style={styles.heroTop}>
        <View style={styles.heroBadge}>
          <Ionicons name="sparkles" size={14} color="#FFFFFF" />
          <Body style={styles.heroBadgeText}>Itinerario inteligente</Body>
        </View>
      </View>
      <H1 style={styles.heroTitle}>Decime a dónde. Yo organizo el cómo.</H1>
      <Body style={styles.heroBody}>
        Un viaje por días, zonas y horarios, listo para vivir.
      </Body>
      <Pressable
        accessibilityRole="search"
        accessibilityLabel="Buscar un destino para crear viaje"
        onPress={onCreate}
        style={({ pressed }) => [styles.searchAction, pressed && styles.searchPressed]}>
        <View style={styles.searchIcon}>
          <Ionicons name="search" size={20} color="#1D2733" />
        </View>
        <View style={{ flex: 1 }}>
          <Body style={styles.searchLabel}>¿A dónde querés ir?</Body>
          <Body style={styles.searchHint}>Ciudad, país o ese lugar que guardaste</Body>
        </View>
        <Ionicons name="arrow-forward-circle" size={30} color="#FF6B4A" />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onSurprise}
        style={({ pressed }) => [styles.surprise, pressed && styles.pressed]}>
        <Ionicons name="shuffle-outline" size={18} color="#FFFFFF" />
        <Body style={styles.surpriseText}>Sorprendeme con un destino</Body>
      </Pressable>
    </CityImage>
  );
}

function DestinationCard({
  city,
  width,
  index,
  onPress,
}: {
  city: City;
  width: number;
  index: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Planificar viaje a ${city.name}, ${city.country}`}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.destinationPressed]}>
      <CityImage city={city} scrim={0.28} style={[styles.destinationCard, { width }]}>
        <View style={styles.destinationTop}>
          <View style={styles.numberBadge}>
            <Body style={styles.numberText}>{String(index + 1).padStart(2, '0')}</Body>
          </View>
          <View style={styles.planPill}>
            <Body style={styles.planPillText}>Planificar</Body>
            <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
          </View>
        </View>
        <View>
          <Body style={styles.destinationName}>{city.name}</Body>
          <Body style={styles.destinationCountry}>{city.country}</Body>
        </View>
      </CityImage>
    </Pressable>
  );
}

function NextTripCard({ trip, onOpen, onShare }: { trip: Trip; onOpen: () => void; onShare: () => void }) {
  const city = cityById(trip.cityId);
  const status = tripStatusOf(trip);
  const stats = tripStats(trip.days);
  const daysLeft = daysUntil(trip.startDate);
  const countdown =
    status === 'encurso'
      ? 'Estás viajando'
      : status === 'finalizado'
        ? 'Volvé a tus recuerdos'
        : daysLeft === 0
          ? 'Tu viaje empieza hoy'
          : `Faltan ${daysLeft} días`;

  return (
    <CityImage city={city} scrim={0.38} style={styles.next}>
      <View style={styles.nextTop}>
        <View style={styles.tripStatus}>
          <View style={styles.liveDot} />
          <Body style={styles.tripStatusText}>{countdown}</Body>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Compartir viaje"
          hitSlop={8}
          onPress={onShare}
          style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}>
          <Ionicons name="share-outline" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
      <View style={styles.nextCopy}>
        <Body style={styles.nextCity}>{trip.cityName}</Body>
        <Body style={styles.nextMeta}>
          {fmtRange(trip.startDate, trip.endDate)} · {stats.days} días · {stats.activities} actividades
        </Body>
      </View>
      <View style={styles.nextActions}>
        <Button
          title={status === 'encurso' ? 'Ver mi día' : 'Abrir itinerario'}
          icon="arrow-forward"
          variant="secondary"
          size="md"
          onPress={onOpen}
          style={{ flex: 1 }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Editar viaje"
          onPress={onOpen}
          style={({ pressed }) => [styles.editTrip, pressed && styles.pressed]}>
          <Ionicons name="options-outline" size={21} color="#FFFFFF" />
        </Pressable>
      </View>
    </CityImage>
  );
}

function ContextualActions({
  trip,
  onCreate,
  onPlan,
  onHotel,
  onTickets,
  onPacking,
}: {
  trip?: Trip;
  onCreate: () => void;
  onPlan: () => void;
  onHotel: () => void;
  onTickets: () => void;
  onPacking: () => void;
}) {
  const t = useTheme();
  if (!trip) {
    return (
      <View style={styles.contextSection}>
        <View><H2>Organizá tu próximo viaje en minutos</H2><Body muted style={{ marginTop: 4 }}>Elegí el destino y nosotros ordenamos cada día por vos.</Body></View>
        <Card style={styles.startCard}>
          {[
            ['location-outline', 'Elegí destino y fechas'],
            ['options-outline', 'Contanos tu ritmo e intereses'],
            ['map-outline', 'Recibí un plan por zonas y horarios'],
          ].map(([icon, label], index) => (
            <View key={label} style={styles.startStep}>
              <View style={[styles.startNumber, { backgroundColor: index === 2 ? t.secondarySoft : t.primarySoft }]}><Body style={{ color: index === 2 ? t.secondary : t.primary, fontWeight: '900' }}>{index + 1}</Body></View>
              <Ionicons name={icon as any} size={19} color={t.textSecondary} />
              <Body style={{ flex: 1, fontWeight: '800' }}>{label}</Body>
            </View>
          ))}
          <Button title="Crear mi primer viaje" icon="sparkles-outline" onPress={onCreate} />
        </Card>
      </View>
    );
  }

  const allActivities = trip.days.flatMap((day) => day.activities);
  const packed = (trip.packingItems ?? []).filter((item) => item.packed).length;
  const totalPacking = (trip.packingItems ?? []).length;
  const tasks = [
    !trip.accommodation ? { icon: 'bed-outline', title: 'Agregar alojamiento', text: 'Mejora el primer y último traslado', action: onHotel, tone: t.primary } : null,
    !(trip.tickets ?? []).length ? { icon: 'ticket-outline', title: 'Revisar tickets', text: `${allActivities.length} actividades por comprobar`, action: onTickets, tone: t.warning } : null,
    totalPacking === 0 || packed < totalPacking ? { icon: 'bag-check-outline', title: 'Preparar la valija', text: totalPacking ? `${packed} de ${totalPacking} listos` : 'Crear lista inteligente', action: onPacking, tone: t.secondary } : null,
  ].filter(Boolean) as { icon: any; title: string; text: string; action: () => void; tone: string }[];

  return (
    <View style={styles.contextSection}>
      <View style={styles.contextHeading}>
        <View style={{ flex: 1 }}><H2>{tasks.length ? 'Completá lo importante' : 'Todo listo para tu próxima aventura'}</H2><Body muted style={{ marginTop: 4 }}>{tasks.length ? 'Acciones concretas para llegar con todo resuelto.' : 'Tu viaje está preparado. Podés revisar el plan cuando quieras.'}</Body></View>
        <Pressable onPress={onCreate} style={[styles.addTrip, { borderColor: t.border }]}><Ionicons name="add" size={19} color={t.primary} /><Body style={{ color: t.primary, fontWeight: '800', fontSize: 12 }}>Otro viaje</Body></Pressable>
      </View>
      <Card style={{ padding: 0 }}>
        {(tasks.length ? tasks : [{ icon: 'checkmark-done-outline', title: 'Revisar itinerario', text: `${trip.days.length} días organizados`, action: onPlan, tone: t.secondary }]).map((task, index, list) => (
          <Pressable key={task.title} onPress={task.action} style={({ pressed }) => [styles.contextRow, index < list.length - 1 && { borderBottomColor: t.border, borderBottomWidth: 1 }, pressed && styles.pressed]}>
            <View style={[styles.contextIcon, { backgroundColor: `${task.tone}18` }]}><Ionicons name={task.icon} size={21} color={task.tone} /></View>
            <View style={{ flex: 1 }}><Body style={{ fontWeight: '900' }}>{task.title}</Body><Body muted style={{ fontSize: 12 }}>{task.text}</Body></View>
            <Ionicons name="chevron-forward" size={18} color={t.textSecondary} />
          </Pressable>
        ))}
      </Card>
    </View>
  );
}

function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const t = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <H2 style={{ flex: 1 }}>{title}</H2>
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          hitSlop={8}
          style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}>
          <Body style={{ color: t.primary, fontWeight: '800', fontSize: 13 }}>{action}</Body>
          <Ionicons name="chevron-forward" size={15} color={t.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

function TripCommandCenter({
  trip,
  onPlan,
  onMap,
  onHotel,
  onTickets,
}: {
  trip: Trip;
  onPlan: () => void;
  onMap: () => void;
  onHotel: () => void;
  onTickets: () => void;
}) {
  const t = useTheme();
  const today = trip.days.find((item) => item.date === new Date().toISOString().slice(0, 10));
  const ticketCount = trip.tickets?.length ?? 0;
  const tools = [
    {
      id: 'plan',
      icon: 'today-outline',
      eyebrow: today ? 'Ahora' : 'Itinerario',
      title: today ? `${today.activities.length} paradas hoy` : 'Ver el día completo',
      onPress: onPlan,
      color: t.primary,
      bg: t.primarySoft,
    },
    {
      id: 'map',
      icon: 'navigate-outline',
      eyebrow: 'Ruta',
      title: 'Mapa y traslados',
      onPress: onMap,
      color: t.secondary,
      bg: t.secondarySoft,
    },
    {
      id: 'hotel',
      icon: 'bed-outline',
      eyebrow: 'Tu base',
      title: trip.accommodation?.name ?? 'Agregar alojamiento',
      onPress: onHotel,
      color: t.text,
      bg: t.backgroundElement,
    },
    {
      id: 'tickets',
      icon: 'ticket-outline',
      eyebrow: `${ticketCount} ${ticketCount === 1 ? 'entrada' : 'entradas'}`,
      title: ticketCount ? 'Abrir billetera' : 'Guardar tickets',
      onPress: onTickets,
      color: t.warning,
      bg: `${t.warning}18`,
    },
  ];

  return (
    <View style={styles.commandSection}>
      <View style={styles.commandHeading}>
        <View>
          <Label style={{ color: t.secondary }}>CENTRO DE VIAJE</Label>
          <H2>Todo lo importante, a un toque</H2>
        </View>
        <View style={[styles.liveBadge, { backgroundColor: t.secondarySoft }]}>
          <View style={[styles.liveMiniDot, { backgroundColor: t.secondary }]} />
          <Body style={{ color: t.secondary, fontSize: 11, fontWeight: '800' }}>LISTO</Body>
        </View>
      </View>
      <View style={styles.commandGrid}>
        {tools.map((tool) => (
          <Pressable
            key={tool.id}
            accessibilityRole="button"
            onPress={tool.onPress}
            style={({ pressed }) => [
              styles.commandCard,
              { backgroundColor: tool.bg, borderColor: `${tool.color}20` },
              pressed && styles.commandPressed,
            ]}>
            <View style={styles.commandTop}>
              <Ionicons name={tool.icon as any} size={22} color={tool.color} />
              <Ionicons name="arrow-up-outline" size={17} color={tool.color} style={{ transform: [{ rotate: '45deg' }] }} />
            </View>
            <View>
              <Label style={{ color: tool.color, fontSize: 10 }}>{tool.eyebrow}</Label>
              <Body numberOfLines={2} style={{ fontWeight: '900', marginTop: 3, lineHeight: 18 }}>
                {tool.title}
              </Body>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function LivePlanPreview() {
  const t = useTheme();
  const stops = [
    { time: '09:30', title: 'Mercado local', meta: '45 min · a 6 min caminando', icon: 'storefront-outline' },
    { time: '11:00', title: 'Museo imprescindible', meta: 'Reserva recomendada', icon: 'color-palette-outline' },
    { time: '13:15', title: 'Almuerzo sin apuro', meta: 'Cerca de tu próxima parada', icon: 'restaurant-outline' },
  ];

  return (
    <View style={styles.previewSection}>
      <View>
        <H2>Así se siente tener el día resuelto</H2>
        <Body muted style={{ marginTop: 4 }}>
          Una ruta clara, con aire para disfrutarla.
        </Body>
      </View>
      <Card style={styles.timeline}>
        <View style={[styles.zonePill, { backgroundColor: t.secondarySoft }]}>
          <Ionicons name="navigate-outline" size={15} color={t.secondary} />
          <Body style={{ color: t.secondary, fontWeight: '800', fontSize: 12 }}>Día 1 · Centro histórico</Body>
        </View>
        {stops.map((stop, index) => (
          <View key={stop.time} style={styles.stop}>
            <View style={styles.timeColumn}>
              <Body style={{ fontWeight: '800', fontSize: 13 }}>{stop.time}</Body>
              {index < stops.length - 1 && <View style={[styles.routeLine, { backgroundColor: t.secondary }]} />}
            </View>
            <View style={[styles.stopIcon, { backgroundColor: index === 0 ? t.primarySoft : t.secondarySoft }]}>
              <Ionicons
                name={stop.icon as any}
                size={18}
                color={index === 0 ? t.primary : t.secondary}
              />
            </View>
            <View style={{ flex: 1, paddingBottom: index < stops.length - 1 ? 18 : 0 }}>
              <Body style={{ fontWeight: '800' }}>{stop.title}</Body>
              <Body muted style={{ fontSize: 12 }}>{stop.meta}</Body>
            </View>
          </View>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 24, paddingBottom: 8 },
  header: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  greeting: { fontSize: 25, lineHeight: 31, marginTop: 2, maxWidth: 280 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72 },
  hero: {
    minHeight: 430,
    marginHorizontal: Spacing.three,
    borderRadius: 24,
    padding: Spacing.four,
    justifyContent: 'flex-end',
    boxShadow: '0 18px 40px rgba(29,39,51,0.16)',
  },
  heroTop: { position: 'absolute', top: 20, left: 20 },
  heroBadge: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: 'rgba(20,25,31,0.46)',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: Radius.pill,
  },
  heroBadgeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  heroTitle: { color: '#FFFFFF', fontSize: 34, lineHeight: 38, letterSpacing: -0.8, maxWidth: 320 },
  heroBody: { color: '#FFFFFF', opacity: 0.9, marginTop: 8, fontSize: 16, lineHeight: 22 },
  searchAction: {
    minHeight: 72,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 10,
    paddingRight: 14,
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  searchPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  searchIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FAF8F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchLabel: { color: '#1D2733', fontWeight: '800', fontSize: 15 },
  searchHint: { color: '#667085', fontSize: 11, lineHeight: 15, marginTop: 1 },
  surprise: {
    minHeight: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 7,
  },
  surpriseText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  sectionHeader: {
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  commandSection: { paddingHorizontal: Spacing.three, gap: Spacing.three },
  commandHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: Radius.pill },
  liveMiniDot: { width: 6, height: 6, borderRadius: 3 },
  commandGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  commandCard: {
    width: '48%',
    flexGrow: 1,
    minHeight: 128,
    borderRadius: 19,
    borderWidth: 1,
    padding: 15,
    justifyContent: 'space-between',
  },
  commandTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  commandPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  textAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center' },
  moodRail: { paddingHorizontal: Spacing.three, gap: 9 },
  mood: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  destinationRail: { paddingHorizontal: Spacing.three, gap: 12 },
  destinationPressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  destinationCard: {
    height: 330,
    borderRadius: 22,
    padding: 18,
    justifyContent: 'space-between',
    boxShadow: '0 12px 28px rgba(29,39,51,0.14)',
  },
  destinationTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  numberBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  planPill: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderRadius: Radius.pill,
  },
  planPillText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  destinationName: { color: '#FFFFFF', fontWeight: '900', fontSize: 30, lineHeight: 34 },
  destinationCountry: { color: '#FFFFFF', opacity: 0.88, fontSize: 14, marginTop: 2 },
  editorialSection: { gap: 12 },
  contextSection: { paddingHorizontal: Spacing.three, gap: 12 },
  contextHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  addTrip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: 12 },
  contextRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15 },
  contextIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  startCard: { gap: Spacing.three },
  startStep: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  startNumber: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  editorialCard: {
    minHeight: 160,
    marginHorizontal: Spacing.three,
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  editorialIcon: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorialCopy: { flex: 1 },
  editorialTitle: { color: '#FFFFFF', fontWeight: '900', fontSize: 19, lineHeight: 23 },
  editorialSubtitle: { color: '#FFFFFF', opacity: 0.85, fontSize: 13, marginTop: 3 },
  roundArrow: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  next: {
    minHeight: 400,
    marginHorizontal: Spacing.three,
    borderRadius: 24,
    padding: Spacing.four,
    justifyContent: 'space-between',
    boxShadow: '0 18px 40px rgba(29,39,51,0.16)',
  },
  nextTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tripStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(0,0,0,0.34)',
    paddingHorizontal: 12,
    minHeight: 38,
    borderRadius: Radius.pill,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#65D6B9' },
  tripStatusText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  shareButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextCopy: { marginTop: 'auto', marginBottom: 18 },
  nextCity: { color: '#FFFFFF', fontSize: 38, lineHeight: 42, fontWeight: '900' },
  nextMeta: { color: '#FFFFFF', opacity: 0.9, marginTop: 5 },
  nextActions: { flexDirection: 'row', gap: 9 },
  editTrip: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewSection: { paddingHorizontal: Spacing.three, gap: 12 },
  timeline: { padding: 18, borderWidth: 0, borderRadius: 18 },
  zonePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    marginBottom: 18,
  },
  stop: { flexDirection: 'row', gap: 10, minHeight: 58 },
  timeColumn: { width: 45, alignItems: 'flex-start' },
  routeLine: { width: 2, flex: 1, marginLeft: 8, marginTop: 5, opacity: 0.5 },
  stopIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promise: {
    marginHorizontal: Spacing.three,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
});
