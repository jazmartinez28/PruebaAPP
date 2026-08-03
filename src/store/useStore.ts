import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { REMOTE_CONFIG } from '@/constants/config';
import { cityById } from '@/data/cities';
import { mergeRuntimePlaces, placeById, setRuntimePlaces } from '@/data/places';
import { generateItinerary } from '@/lib/generate';
import { fetchTripEvents } from '@/lib/events';
import { fetchCityPlaces } from '@/lib/place-provider';
import { rescheduleDay } from '@/lib/trip';
import type { Accommodation, AppPreferences, Budget, Category, Draft, Pace, PackingCategory, Place, Ticket, Trip, User } from '@/types';

const emptyDraft = (): Draft => ({
  accommodation: null,
  interests: [],
  pace: 'equilibrado',
  budget: 'moderado',
  mustSeeIds: [],
  dayStartMin: 9 * 60,
});

const defaultPreferences = (): AppPreferences => ({
  language: 'es',
  currency: 'auto',
  travelStyle: 'equilibrado',
  notifications: {
    enabled: false,
    tripReminders: true,
    weekBefore: true,
    dayBefore: true,
    tripStart: true,
    dailySummary: true,
    firstActivity: true,
    upcomingActivity: false,
    activityLeadMin: 30,
    tickets: true,
  },
});

// Cuentas locales (demo). En producción esto lo reemplaza Supabase Auth.
type Account = { name: string; email: string; password: string };

type State = {
  hydrated: boolean;
  user: User | null;
  preferences: AppPreferences;
  accounts: Record<string, Account>;
  draft: Draft;
  trips: Trip[];
  externalPlaces: Place[];
  catalogStatus: Record<string, 'idle' | 'loading' | 'ready' | 'error'>;
  eventStatus: Record<string, 'idle' | 'loading' | 'ready' | 'error' | 'unconfigured'>;
  _undo: { tripId: string; days: Trip['days']; removedIds: string[] } | null;
  undo: () => void;

  // auth
  signup: (name: string, email: string, password: string) => { ok: boolean; error?: string };
  login: (email: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
  upgradeToPremium: () => void;
  updateProfile: (patch: Partial<Pick<User, 'name' | 'email' | 'photoUri'>>) => { ok: boolean; error?: string };
  changePassword: (currentPassword: string, nextPassword: string) => { ok: boolean; error?: string };
  updatePreferences: (patch: Partial<AppPreferences>) => void;
  deleteAccount: () => void;

  // draft
  setDraft: (partial: Partial<Draft>) => void;
  resetDraft: () => void;
  toggleInterest: (c: Category) => void;
  toggleMustSee: (placeId: string) => void;
  setPace: (p: Pace) => void;
  setBudget: (b: Budget) => void;
  setAccommodation: (a: Accommodation) => void;
  loadCityCatalog: (cityId: string) => Promise<{ count: number; error?: string }>;
  loadTripEvents: (cityId: string, startDate: string, endDate: string) => Promise<{ count: number; error?: string }>;
  addManualMustSee: (input: { name: string; address?: string; url?: string }) => void;
  addSearchedMustSee: (place: Place) => void;

  // trips
  createTripFromDraft: () => { id?: string; error?: 'limit' | 'invalid' };
  regenerate: (tripId: string) => void;
  deleteTrip: (tripId: string) => void;
  toggleSaved: (tripId: string, placeId: string) => void;
  updateTripAccommodation: (tripId: string, accommodation: Accommodation) => void;
  setDayStart: (tripId: string, dayIndex: number, startMin: number) => void;
  addTicket: (tripId: string, ticket: Omit<Ticket, 'id' | 'createdAt'>) => void;
  removeTicket: (tripId: string, ticketId: string) => void;
  addPackingItem: (tripId: string, label: string, category: PackingCategory, suggested?: boolean) => void;
  updatePackingItem: (tripId: string, itemId: string, patch: { label?: string; category?: PackingCategory; packed?: boolean }) => void;
  removePackingItem: (tripId: string, itemId: string) => void;
  addPackingSuggestions: (tripId: string, items: Trip['packingItems']) => void;

  // edición del itinerario
  removeActivity: (tripId: string, activityId: string) => void;
  addActivity: (tripId: string, dayIndex: number, placeId: string) => void;
  replaceActivity: (tripId: string, activityId: string, newPlaceId: string) => void;
  moveActivityToDay: (tripId: string, activityId: string, toDayIndex: number) => void;
  moveActivityWithinDay: (tripId: string, activityId: string, delta: -1 | 1) => void;
  setActivityStatus: (tripId: string, activityId: string, status: Trip['days'][number]['activities'][number]['status']) => void;
  updateActivityDetails: (tripId: string, activityId: string, patch: { startMin?: number; durationMin?: number; status?: Trip['days'][number]['activities'][number]['status']; note?: string }) => void;
};

let idc = 0;
const newId = (p: string) => `${p}${Date.now().toString(36)}${(idc++).toString(36)}`;

function touch(trip: Trip): Trip {
  return { ...trip, updatedAt: Date.now() };
}

function snapOf(s: State, tripId: string): State['_undo'] {
  const cur = s.trips.find((t) => t.id === tripId);
  return cur ? { tripId, days: cur.days, removedIds: cur.removedIds } : s._undo;
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      hydrated: false,
      user: null,
      preferences: defaultPreferences(),
      accounts: {},
      draft: emptyDraft(),
      trips: [],
      externalPlaces: [],
      catalogStatus: {},
      eventStatus: {},
      _undo: null,

      undo: () =>
        set((s) => {
          if (!s._undo) return {};
          const u = s._undo;
          return {
            _undo: null,
            trips: s.trips.map((t) => (t.id === u.tripId ? touch({ ...t, days: u.days, removedIds: u.removedIds }) : t)),
          };
        }),

      signup: (name, email, password) => {
        email = email.trim().toLowerCase();
        if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return { ok: false, error: 'Completá los datos y usá una contraseña de al menos 8 caracteres.' };
        if (get().accounts[email]) return { ok: false, error: 'Ya existe una cuenta con ese correo.' };
        const user: User = { id: newId('u'), email, name: name.trim(), plan: 'gratis' };
        set((s) => ({ accounts: { ...s.accounts, [email]: { name: name.trim(), email, password } }, user }));
        return { ok: true };
      },
      login: (email, password) => {
        email = email.trim().toLowerCase();
        const acc = get().accounts[email];
        if (!acc || acc.password !== password) return { ok: false, error: 'Correo o contraseña incorrectos.' };
        set({ user: { id: newId('u'), email, name: acc.name, plan: get().user?.plan ?? 'gratis' } });
        return { ok: true };
      },
      logout: () => set({ user: null }),
      upgradeToPremium: () => set((s) => (s.user ? { user: { ...s.user, plan: 'premium' } } : {})),
      updateProfile: (patch) => {
        const current = get().user;
        if (!current) return { ok: false, error: 'Iniciá sesión para editar tu perfil.' };
        const email = patch.email?.trim().toLowerCase() ?? current.email;
        const name = patch.name?.trim() ?? current.name;
        if (!name || !/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: 'Revisá el nombre y el correo.' };
        if (email !== current.email && get().accounts[email]) return { ok: false, error: 'Ese correo ya está en uso.' };
        set((state) => {
          const account = state.accounts[current.email];
          const accounts = { ...state.accounts };
          if (account) {
            delete accounts[current.email];
            accounts[email] = { ...account, name, email };
          }
          return { accounts, user: { ...current, ...patch, name, email } };
        });
        return { ok: true };
      },
      changePassword: (currentPassword, nextPassword) => {
        const current = get().user;
        if (!current) return { ok: false, error: 'Iniciá sesión para cambiar tu contraseña.' };
        const account = get().accounts[current.email];
        if (!account || account.password !== currentPassword) return { ok: false, error: 'La contraseña actual no es correcta.' };
        if (nextPassword.length < 8) return { ok: false, error: 'La nueva contraseña debe tener al menos 8 caracteres.' };
        set((state) => ({ accounts: { ...state.accounts, [current.email]: { ...account, password: nextPassword } } }));
        return { ok: true };
      },
      updatePreferences: (patch) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            ...patch,
            notifications: patch.notifications
              ? { ...state.preferences.notifications, ...patch.notifications }
              : state.preferences.notifications,
          },
        })),
      deleteAccount: () =>
        set((state) => {
          if (!state.user) return {};
          const accounts = { ...state.accounts };
          delete accounts[state.user.email];
          return { user: null, accounts, trips: [], draft: emptyDraft(), preferences: defaultPreferences() };
        }),

      setDraft: (partial) => set((s) => ({ draft: { ...s.draft, ...partial } })),
      resetDraft: () => set({ draft: emptyDraft() }),
      toggleInterest: (c) =>
        set((s) => ({
          draft: {
            ...s.draft,
            interests: s.draft.interests.includes(c)
              ? s.draft.interests.filter((x) => x !== c)
              : [...s.draft.interests, c],
          },
        })),
      toggleMustSee: (placeId) =>
        set((s) => ({
          draft: {
            ...s.draft,
            mustSeeIds: s.draft.mustSeeIds.includes(placeId)
              ? s.draft.mustSeeIds.filter((x) => x !== placeId)
              : [...s.draft.mustSeeIds, placeId],
          },
        })),
      setPace: (p) => set((s) => ({ draft: { ...s.draft, pace: p } })),
      setBudget: (b) => set((s) => ({ draft: { ...s.draft, budget: b } })),
      setAccommodation: (a) => set((s) => ({ draft: { ...s.draft, accommodation: a } })),
      loadCityCatalog: async (cityId) => {
        const existing = get().externalPlaces.filter((place) => place.cityId === cityId && place.kind !== 'event');
        if (existing.length >= REMOTE_CONFIG.cityCatalogReadyMin) {
          mergeRuntimePlaces(existing);
          return { count: existing.length };
        }
        const city = cityById(cityId);
        if (!city) return { count: 0, error: 'Ciudad no disponible' };
        set((s) => ({ catalogStatus: { ...s.catalogStatus, [cityId]: 'loading' } }));
        try {
          const places = await fetchCityPlaces(city, REMOTE_CONFIG.cityCatalogTarget);
          mergeRuntimePlaces(places);
          set((s) => {
            const otherCities = s.externalPlaces.filter((place) => place.cityId !== cityId || place.kind === 'event');
            return {
              externalPlaces: [...otherCities, ...places],
              catalogStatus: { ...s.catalogStatus, [cityId]: 'ready' },
            };
          });
          return { count: places.length };
        } catch (error) {
          set((s) => ({ catalogStatus: { ...s.catalogStatus, [cityId]: 'error' } }));
          return {
            count: existing.length,
            error: error instanceof Error ? error.message : 'No pudimos ampliar el catálogo',
          };
        }
      },
      loadTripEvents: async (cityId, startDate, endDate) => {
        const key = `${cityId}:${startDate}:${endDate}`;
        const existing = get().externalPlaces.filter(
          (place) =>
            place.cityId === cityId &&
            place.kind === 'event' &&
            Boolean(place.eventDate && place.eventDate >= startDate && place.eventDate <= endDate),
        );
        if (existing.length) {
          mergeRuntimePlaces(existing);
          set((state) => ({ eventStatus: { ...state.eventStatus, [key]: 'ready' } }));
          return { count: existing.length };
        }
        const city = cityById(cityId);
        if (!city) return { count: 0, error: 'Ciudad no disponible' };
        if (!process.env.EXPO_PUBLIC_TICKETMASTER_API_KEY) {
          set((state) => ({ eventStatus: { ...state.eventStatus, [key]: 'unconfigured' } }));
          return { count: 0, error: 'Proveedor de eventos sin configurar' };
        }
        set((state) => ({ eventStatus: { ...state.eventStatus, [key]: 'loading' } }));
        try {
          const events = await fetchTripEvents(city, startDate, endDate);
          mergeRuntimePlaces(events);
          set((state) => {
            const ids = new Set(events.map((event) => event.id));
            return {
              externalPlaces: [...state.externalPlaces.filter((place) => !ids.has(place.id)), ...events],
              eventStatus: { ...state.eventStatus, [key]: 'ready' },
            };
          });
          return { count: events.length };
        } catch (error) {
          set((state) => ({ eventStatus: { ...state.eventStatus, [key]: 'error' } }));
          return { count: 0, error: error instanceof Error ? error.message : 'No pudimos consultar eventos' };
        }
      },
      addManualMustSee: (input) =>
        set((s) => {
          if (!s.draft.cityId || !input.name.trim()) return {};
          const city = cityById(s.draft.cityId);
          if (!city) return {};
          const coordinates = input.url?.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
          const parsedLat = coordinates ? Number(coordinates[1]) : undefined;
          const parsedLng = coordinates ? Number(coordinates[2]) : undefined;
          const normalized = input.name.trim().toLowerCase();
          const duplicate = [...s.externalPlaces].find(
            (place) => place.cityId === city.id && place.name.toLowerCase() === normalized,
          );
          if (duplicate) {
            return {
              draft: {
                ...s.draft,
                mustSeeIds: s.draft.mustSeeIds.includes(duplicate.id)
                  ? s.draft.mustSeeIds
                  : [...s.draft.mustSeeIds, duplicate.id],
              },
            };
          }
          const place: Place = {
            id: newId('manual'),
            cityId: city.id,
            name: input.name.trim(),
            categories: ['local'],
            lat: parsedLat ?? s.draft.accommodation?.lat ?? city.lat,
            lng: parsedLng ?? s.draft.accommodation?.lng ?? city.lng,
            zone: parsedLat != null ? 'Ubicación confirmada desde el enlace' : 'Ubicación por confirmar',
            durationMin: 60,
            price: 1,
            rating: 0,
            desc: 'Lugar agregado manualmente por el viajero.',
            address: input.address?.trim() || undefined,
            officialUrl: input.url?.trim() || undefined,
            confident: parsedLat != null,
            source: 'curated',
          };
          mergeRuntimePlaces([place]);
          return {
            externalPlaces: [...s.externalPlaces, place],
            draft: { ...s.draft, mustSeeIds: [...s.draft.mustSeeIds, place.id] },
          };
        }),

      addSearchedMustSee: (place) =>
        set((state) => {
          if (!state.draft.cityId || place.cityId !== state.draft.cityId) return {};
          const normalized = place.name.trim().toLocaleLowerCase();
          const duplicate = state.externalPlaces.find(
            (candidate) =>
              candidate.cityId === place.cityId &&
              (candidate.id === place.id || candidate.name.trim().toLocaleLowerCase() === normalized),
          );
          const selected = duplicate ?? place;
          mergeRuntimePlaces([selected]);
          return {
            externalPlaces: duplicate
              ? state.externalPlaces
              : [...state.externalPlaces.filter((candidate) => candidate.id !== place.id), place],
            draft: {
              ...state.draft,
              mustSeeIds: state.draft.mustSeeIds.includes(selected.id)
                ? state.draft.mustSeeIds
                : [...state.draft.mustSeeIds, selected.id],
            },
          };
        }),

      createTripFromDraft: () => {
        const { draft, trips, user } = get();
        const city = cityById(draft.cityId!);
        const accommodationComplete =
          Boolean(draft.accommodationChoice) &&
          (draft.accommodationChoice !== 'yes' || Boolean(draft.accommodation));
        const travelerProfileComplete =
          Boolean(draft.partySize && draft.partySize > 0) &&
          Boolean(draft.groupType) &&
          draft.dayStartMin != null;
        if (
          !city ||
          !draft.startDate ||
          !draft.endDate ||
          !accommodationComplete ||
          !draft.interests.length ||
          !travelerProfileComplete
        ) return { error: 'invalid' };
        // límite freemium
        const isPremium = user?.plan === 'premium';
        if (
          !isPremium &&
          typeof REMOTE_CONFIG.freeTripLimit === 'number' &&
          trips.length >= REMOTE_CONFIG.freeTripLimit
        ) return { error: 'limit' };

        const days = generateItinerary(draft);
        const trip: Trip = {
          id: newId('t'),
          cityId: city.id,
          cityName: city.name,
          country: city.country,
          startDate: draft.startDate,
          endDate: draft.endDate,
          accommodation: draft.accommodation,
          interests: draft.interests,
          pace: draft.pace,
          budget: draft.budget,
          mustSeeIds: draft.mustSeeIds,
          travelIntentText: draft.travelIntentText,
          travelIntentAudioUri: draft.travelIntentAudioUri,
          dayStartMin: draft.dayStartMin,
          partySize: draft.partySize,
          groupType: draft.groupType,
          arrivalTime: draft.arrivalTime,
          departureTime: draft.departureTime,
          arrivalPlace: draft.arrivalPlace,
          departurePlace: draft.departurePlace,
          arrivalType: draft.arrivalType,
          departureType: draft.departureType,
          arrivalBufferMin: draft.arrivalBufferMin,
          arrivalTransferMin: draft.arrivalTransferMin,
          departureLeadMin: draft.departureLeadMin,
          departureTransferMin: draft.departureTransferMin,
          checkInTime: draft.checkInTime,
          checkOutTime: draft.checkOutTime,
          canLeaveLuggage: draft.canLeaveLuggage,
          savedIds: [],
          removedIds: [],
          tickets: [],
          packingItems: [],
          days,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((s) => ({ trips: [trip, ...s.trips] }));
        return { id: trip.id };
      },

      regenerate: (tripId) =>
        set((s) => ({
          trips: s.trips.map((t) =>
            t.id === tripId
              ? touch({ ...t, days: generateItinerary({ ...t, cityId: t.cityId } as Draft) })
              : t,
          ),
        })),

      deleteTrip: (tripId) => set((s) => ({ trips: s.trips.filter((t) => t.id !== tripId) })),

      toggleSaved: (tripId, placeId) =>
        set((s) => ({
          trips: s.trips.map((t) =>
            t.id === tripId
              ? touch({
                  ...t,
                  savedIds: t.savedIds.includes(placeId)
                    ? t.savedIds.filter((x) => x !== placeId)
                    : [...t.savedIds, placeId],
                })
              : t,
          ),
        })),
      updateTripAccommodation: (tripId, accommodation) =>
        set((s) => ({
          trips: s.trips.map((trip) =>
            trip.id === tripId ? touch({ ...trip, accommodation }) : trip,
          ),
        })),
      setDayStart: (tripId, dayIndex, startMin) =>
        set((state) => ({
          trips: state.trips.map((trip) => {
            if (trip.id !== tripId) return trip;
            const days = trip.days.map((day, index) =>
              index === dayIndex ? rescheduleDay({ ...day, startMin: Math.max(0, Math.min(1435, startMin)) }) : day,
            );
            return touch({ ...trip, days });
          }),
        })),
      addTicket: (tripId, ticket) =>
        set((s) => ({
          trips: s.trips.map((trip) =>
            trip.id === tripId
              ? touch({
                  ...trip,
                  tickets: [
                    ...(trip.tickets ?? []),
                    { ...ticket, id: newId('ticket'), createdAt: Date.now() },
                  ],
                })
              : trip,
          ),
        })),
      removeTicket: (tripId, ticketId) =>
        set((s) => ({
          trips: s.trips.map((trip) =>
            trip.id === tripId
              ? touch({ ...trip, tickets: (trip.tickets ?? []).filter((ticket) => ticket.id !== ticketId) })
              : trip,
          ),
        })),
      addPackingItem: (tripId, label, category, suggested = false) =>
        set((s) => ({
          trips: s.trips.map((trip) =>
            trip.id === tripId
              ? touch({
                  ...trip,
                  packingItems: [
                    ...(trip.packingItems ?? []),
                    { id: newId('pack'), label: label.trim(), category, packed: false, suggested },
                  ],
                })
              : trip,
          ),
        })),
      updatePackingItem: (tripId, itemId, patch) =>
        set((s) => ({
          trips: s.trips.map((trip) =>
            trip.id === tripId
              ? touch({
                  ...trip,
                  packingItems: (trip.packingItems ?? []).map((item) =>
                    item.id === itemId ? { ...item, ...patch } : item,
                  ),
                })
              : trip,
          ),
        })),
      removePackingItem: (tripId, itemId) =>
        set((s) => ({
          trips: s.trips.map((trip) =>
            trip.id === tripId
              ? touch({ ...trip, packingItems: (trip.packingItems ?? []).filter((item) => item.id !== itemId) })
              : trip,
          ),
        })),
      addPackingSuggestions: (tripId, items) =>
        set((s) => ({
          trips: s.trips.map((trip) => {
            if (trip.id !== tripId) return trip;
            const existing = new Set((trip.packingItems ?? []).map((item) => item.label.toLowerCase()));
            const additions = items.filter((item) => !existing.has(item.label.toLowerCase()));
            return touch({ ...trip, packingItems: [...(trip.packingItems ?? []), ...additions] });
          }),
        })),

      removeActivity: (tripId, activityId) =>
        set((s) => ({
          _undo: snapOf(s, tripId),
          trips: s.trips.map((t) => {
            if (t.id !== tripId) return t;
            let removedPlace: string | undefined;
            const days = t.days.map((d) => {
              const found = d.activities.find((a) => a.id === activityId);
              if (found) removedPlace = found.placeId;
              return found ? rescheduleDay({ ...d, activities: d.activities.filter((a) => a.id !== activityId) }) : d;
            });
            return touch({
              ...t,
              days,
              removedIds: removedPlace ? [...t.removedIds, removedPlace] : t.removedIds,
            });
          }),
        })),

      addActivity: (tripId, dayIndex, placeId) =>
        set((s) => ({
          _undo: snapOf(s, tripId),
          trips: s.trips.map((t) => {
            if (t.id !== tripId) return t;
            const p = placeById(placeId);
            if (!p) return t;
            const days = t.days.map((d, i) =>
              i === dayIndex
                ? rescheduleDay({
                    ...d,
                    activities: [
                      ...d.activities,
                      { id: newId('a'), placeId, startMin: 0, durationMin: p.durationMin, status: 'plan' as const },
                    ],
                  })
                : d,
            );
            return touch({ ...t, days, removedIds: t.removedIds.filter((x) => x !== placeId) });
          }),
        })),

      replaceActivity: (tripId, activityId, newPlaceId) =>
        set((s) => ({
          _undo: snapOf(s, tripId),
          trips: s.trips.map((t) => {
            if (t.id !== tripId) return t;
            const np = placeById(newPlaceId);
            if (!np) return t;
            const days = t.days.map((d) => {
              if (!d.activities.some((a) => a.id === activityId)) return d;
              return rescheduleDay({
                ...d,
                activities: d.activities.map((a) =>
                  a.id === activityId ? { ...a, placeId: newPlaceId, durationMin: np.durationMin, note: undefined } : a,
                ),
              });
            });
            return touch({ ...t, days });
          }),
        })),

      moveActivityToDay: (tripId, activityId, toDayIndex) =>
        set((s) => ({
          _undo: snapOf(s, tripId),
          trips: s.trips.map((t) => {
            if (t.id !== tripId) return t;
            let moved: (typeof t.days)[number]['activities'][number] | undefined;
            let days = t.days.map((d) => {
              const found = d.activities.find((a) => a.id === activityId);
              if (found) {
                moved = found;
                return { ...d, activities: d.activities.filter((a) => a.id !== activityId) };
              }
              return d;
            });
            if (moved) {
              days = days.map((d, i) => (i === toDayIndex ? { ...d, activities: [...d.activities, moved!] } : d));
              days = days.map((d) => rescheduleDay(d));
            }
            return touch({ ...t, days });
          }),
        })),
      moveActivityWithinDay: (tripId, activityId, delta) =>
        set((s) => ({
          _undo: snapOf(s, tripId),
          trips: s.trips.map((trip) => {
            if (trip.id !== tripId) return trip;
            const days = trip.days.map((day) => {
              const index = day.activities.findIndex((activity) => activity.id === activityId);
              if (index < 0) return day;
              const target = index + delta;
              if (target < 0 || target >= day.activities.length) return day;
              const activities = [...day.activities];
              [activities[index], activities[target]] = [activities[target], activities[index]];
              return rescheduleDay({ ...day, activities });
            });
            return touch({ ...trip, days });
          }),
        })),

      setActivityStatus: (tripId, activityId, status) =>
        set((s) => ({
          trips: s.trips.map((t) =>
            t.id !== tripId
              ? t
              : touch({
                  ...t,
                  days: t.days.map((d) => ({
                    ...d,
                    activities: d.activities.map((a) => (a.id === activityId ? { ...a, status } : a)),
                  })),
                }),
          ),
        })),
      updateActivityDetails: (tripId, activityId, patch) =>
        set((s) => ({
          _undo: snapOf(s, tripId),
          trips: s.trips.map((trip) =>
            trip.id !== tripId
              ? trip
              : touch({
                  ...trip,
                  days: trip.days.map((day) => {
                    if (!day.activities.some((activity) => activity.id === activityId)) return day;
                    const activities = day.activities.map((activity) =>
                      activity.id === activityId ? { ...activity, ...patch } : activity,
                    );
                    return patch.startMin != null
                      ? { ...day, activities: activities.sort((a, b) => a.startMin - b.startMin) }
                      : rescheduleDay({ ...day, activities });
                  }),
                }),
          ),
        })),
    }),
    {
      name: 'rumbo-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        user: s.user,
        preferences: s.preferences,
        accounts: s.accounts,
        draft: s.draft,
        trips: s.trips,
        externalPlaces: s.externalPlaces,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.preferences = {
            ...defaultPreferences(),
            ...(state.preferences ?? {}),
            notifications: {
              ...defaultPreferences().notifications,
              ...(state.preferences?.notifications ?? {}),
            },
          };
          state.trips = state.trips.map((trip) => ({
            ...trip,
            tickets: trip.tickets ?? [],
            packingItems: trip.packingItems ?? [],
          }));
          setRuntimePlaces(state.externalPlaces ?? []);
          state.hydrated = true;
        }
      },
    },
  ),
);
