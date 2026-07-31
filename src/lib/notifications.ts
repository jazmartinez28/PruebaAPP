import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { cityById } from '@/data/cities';
import { placeById } from '@/data/places';
import { ticketInfo } from '@/lib/tickets';
import type { NotificationPreferences, Trip } from '@/types';

export type NotificationSyncResult = {
  scheduled: number;
  permission: 'granted' | 'denied' | 'unsupported';
  error?: string;
};

const DAY = 24 * 60 * 60 * 1000;

function atDestinationTime(iso: string, minutes: number, timeZone?: string) {
  const [year, month, day] = iso.split('-').map(Number);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  if (!timeZone) return new Date(year, month - 1, day, hour, minute, 0, 0);
  const target = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let candidate = new Date(target);
  for (let attempt = 0; attempt < 2; attempt++) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(candidate);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const represented = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
    candidate = new Date(candidate.getTime() + target - represented);
  }
  return candidate;
}

async function schedule(id: string, title: string, body: string, date: Date, data: Record<string, string>) {
  if (date.getTime() <= Date.now() + 30_000) return false;
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title, body, data: { ...data, owner: 'rumbo-trip-planner' }, sound: 'default' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: Platform.OS === 'android' ? 'trip-reminders' : undefined,
    },
  });
  return true;
}

export async function getNotificationPermission() {
  if (Platform.OS === 'web') return 'unsupported' as const;
  const permission = await Notifications.getPermissionsAsync();
  return permission.granted ? 'granted' as const : permission.canAskAgain ? 'prompt' as const : 'denied' as const;
}

export async function requestNotificationPermission() {
  if (Platform.OS === 'web') return 'unsupported' as const;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('trip-reminders', {
      name: 'Recordatorios de viaje',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 180, 100, 180],
    });
  }
  const permission = await Notifications.requestPermissionsAsync();
  return permission.granted ? 'granted' as const : 'denied' as const;
}

async function clearRumboNotifications() {
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  const owned = existing.filter((item) => item.content.data?.owner === 'rumbo-trip-planner');
  await Promise.all(owned.map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));
}

export async function syncTripNotifications(
  trips: Trip[],
  preferences: NotificationPreferences,
): Promise<NotificationSyncResult> {
  if (Platform.OS === 'web') return { scheduled: 0, permission: 'unsupported' };
  const permission = await getNotificationPermission();
  if (permission !== 'granted') return { scheduled: 0, permission: 'denied' };

  await clearRumboNotifications();
  if (!preferences.enabled) return { scheduled: 0, permission: 'granted' };

  let scheduled = 0;
  try {
    for (const trip of trips) {
      const city = cityById(trip.cityId);
      const destinationTimeZone = city?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
      const start = atDestinationTime(trip.startDate, 9 * 60, destinationTimeZone);
      const data = { tripId: trip.id, destinationTimeZone };

      if (preferences.tripReminders) {
        if (preferences.weekBefore && await schedule(`trip:${trip.id}:week`, `Falta una semana para ${trip.cityName}`, 'Revisá alojamiento, valija y tickets pendientes.', new Date(start.getTime() - 7 * DAY), data)) scheduled++;
        if (preferences.dayBefore && await schedule(`trip:${trip.id}:day`, `Mañana empieza ${trip.cityName}`, 'Tu itinerario está listo. Revisá los últimos detalles.', new Date(start.getTime() - DAY), data)) scheduled++;
        if (preferences.tripStart && await schedule(`trip:${trip.id}:start`, `Tu viaje a ${trip.cityName} empieza hoy`, 'Abrí el plan del día para ver la primera actividad y cómo llegar.', start, data)) scheduled++;
      }

      for (let dayIndex = 0; dayIndex < trip.days.length; dayIndex++) {
        const day = trip.days[dayIndex];
        const first = day.activities[0];
        if (!first) continue;
        const firstPlace = placeById(first.placeId);
        const firstDate = atDestinationTime(day.date, first.startMin, destinationTimeZone);
        if (preferences.dailySummary && await schedule(
          `trip:${trip.id}:day:${dayIndex}:summary`,
          `Día ${dayIndex + 1} · ${day.zone || trip.cityName}`,
          `${day.activities.length} actividades. Tu recorrido comienza ${firstPlace ? `en ${firstPlace.name}` : 'pronto'}.`,
          atDestinationTime(day.date, Math.max(7 * 60, first.startMin - 90), destinationTimeZone),
          { ...data, dayIndex: String(dayIndex) },
        )) scheduled++;
        if (preferences.firstActivity && await schedule(
          `trip:${trip.id}:day:${dayIndex}:first`,
          `Primera actividad en ${preferences.activityLeadMin} min`,
          firstPlace?.name ?? 'Abrí tu itinerario para ver cómo llegar.',
          new Date(firstDate.getTime() - preferences.activityLeadMin * 60_000),
          { ...data, dayIndex: String(dayIndex), activityId: first.id },
        )) scheduled++;

        if (preferences.upcomingActivity) {
          for (const activity of day.activities.slice(1)) {
            const place = placeById(activity.placeId);
            if (await schedule(
              `trip:${trip.id}:activity:${activity.id}`,
              `Próxima actividad en ${preferences.activityLeadMin} min`,
              place?.name ?? 'Consultá tu itinerario.',
              new Date(atDestinationTime(day.date, activity.startMin, destinationTimeZone).getTime() - preferences.activityLeadMin * 60_000),
              { ...data, dayIndex: String(dayIndex), activityId: activity.id },
            )) scheduled++;
          }
        }
      }

      if (preferences.tickets) {
        const pending = trip.days.flatMap((day) => day.activities).filter((activity) => {
          const place = placeById(activity.placeId);
          const info = place ? ticketInfo(place) : null;
          return Boolean(info && (info.ticket || info.reservation) && !trip.tickets.some((ticket) => ticket.activityId === activity.id));
        });
        if (pending.length && await schedule(
          `trip:${trip.id}:tickets`,
          `${pending.length} ${pending.length === 1 ? 'reserva pendiente' : 'reservas o tickets pendientes'}`,
          `Completalos antes de viajar a ${trip.cityName}.`,
          new Date(start.getTime() - 3 * DAY),
          data,
        )) scheduled++;
      }
    }
    return { scheduled, permission: 'granted' };
  } catch (cause) {
    return {
      scheduled,
      permission: 'granted',
      error: cause instanceof Error ? cause.message : 'No pudimos programar los recordatorios.',
    };
  }
}
