import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { REMOTE_CONFIG } from '@/constants/config';
import { cityById } from '@/data/cities';
import { placeById } from '@/data/places';
import { generateItinerary } from '@/lib/generate';
import { rescheduleDay } from '@/lib/trip';
import type { Accommodation, Budget, Category, Draft, Pace, Trip, User } from '@/types';

const emptyDraft = (): Draft => ({
  accommodation: null,
  interests: [],
  pace: 'equilibrado',
  budget: 'moderado',
  mustSeeIds: [],
});

// Cuentas locales (demo). En producción esto lo reemplaza Supabase Auth.
type Account = { name: string; email: string; password: string };

type State = {
  hydrated: boolean;
  user: User | null;
  accounts: Record<string, Account>;
  draft: Draft;
  trips: Trip[];
  _undo: { tripId: string; days: Trip['days']; removedIds: string[] } | null;
  undo: () => void;

  // auth
  signup: (name: string, email: string, password: string) => { ok: boolean; error?: string };
  login: (email: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
  upgradeToPremium: () => void;

  // draft
  setDraft: (partial: Partial<Draft>) => void;
  resetDraft: () => void;
  toggleInterest: (c: Category) => void;
  toggleMustSee: (placeId: string) => void;
  setPace: (p: Pace) => void;
  setBudget: (b: Budget) => void;
  setAccommodation: (a: Accommodation) => void;

  // trips
  createTripFromDraft: () => { id?: string; error?: 'limit' };
  regenerate: (tripId: string) => void;
  deleteTrip: (tripId: string) => void;
  toggleSaved: (tripId: string, placeId: string) => void;

  // edición del itinerario
  removeActivity: (tripId: string, activityId: string) => void;
  addActivity: (tripId: string, dayIndex: number, placeId: string) => void;
  replaceActivity: (tripId: string, activityId: string, newPlaceId: string) => void;
  moveActivityToDay: (tripId: string, activityId: string, toDayIndex: number) => void;
  setActivityStatus: (tripId: string, activityId: string, status: Trip['days'][number]['activities'][number]['status']) => void;
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
      accounts: {},
      draft: emptyDraft(),
      trips: [],
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
        if (!name.trim() || !email || password.length < 4) return { ok: false, error: 'Completá los datos (contraseña de 4+).' };
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

      createTripFromDraft: () => {
        const { draft, trips, user } = get();
        const city = cityById(draft.cityId!);
        if (!city || !draft.startDate || !draft.endDate) return { error: undefined as never };
        // límite freemium
        const isPremium = user?.plan === 'premium';
        if (!isPremium && trips.length >= REMOTE_CONFIG.freeTripLimit) return { error: 'limit' };

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
          savedIds: [],
          removedIds: [],
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
    }),
    {
      name: 'rumbo-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ user: s.user, accounts: s.accounts, trips: s.trips }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);
