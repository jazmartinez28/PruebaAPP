import * as Calendar from 'expo-calendar';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { cityById } from '@/data/cities';
import { placeById } from '@/data/places';
import { fmtDate, fmtRange } from '@/lib/dates';
import { legBetween, minToHHMM } from '@/lib/geo';
import type { Trip } from '@/types';

export type ExportDetail = 'summary' | 'complete';

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const slug = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

function mapUrlForDay(trip: Trip, dayIndex: number) {
  const day = trip.days[dayIndex];
  const points = [
    ...(trip.accommodation ? [{ lat: trip.accommodation.lat, lng: trip.accommodation.lng }] : []),
    ...day.activities.map((activity) => placeById(activity.placeId)).filter(Boolean).map((place) => ({ lat: place!.lat, lng: place!.lng })),
    ...(trip.accommodation ? [{ lat: trip.accommodation.lat, lng: trip.accommodation.lng }] : []),
  ];
  if (points.length < 2) return undefined;
  const origin = `${points[0].lat},${points[0].lng}`;
  const destination = `${points[points.length - 1].lat},${points[points.length - 1].lng}`;
  const waypoints = points.slice(1, -1).map((point) => `${point.lat},${point.lng}`).join('|');
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''}&travelmode=walking`;
}

export function tripExportHtml(trip: Trip, detail: ExportDetail) {
  const daySections = trip.days.map((day, dayIndex) => {
    const rows = day.activities.map((activity, activityIndex) => {
      const place = placeById(activity.placeId);
      if (!place) return '';
      const next = day.activities[activityIndex + 1];
      const nextPlace = next ? placeById(next.placeId) : null;
      const leg = nextPlace ? legBetween(place, nextPlace) : null;
      const extra = detail === 'complete'
        ? `<div class="meta">${escapeHtml(place.address ?? place.zone)} · ${activity.durationMin} min · ${escapeHtml(place.desc)}</div>${place.officialUrl ? `<div><a href="${escapeHtml(place.officialUrl)}">Fuente oficial</a></div>` : ''}`
        : `<div class="meta">${escapeHtml(place.zone)} · ${activity.durationMin} min</div>`;
      return `<div class="activity"><div class="time">${minToHHMM(activity.startMin)}</div><div class="activity-body"><strong>${escapeHtml(place.name)}</strong>${extra}${leg ? `<div class="transfer">Después: ${leg.minutes} min · ${Math.round(leg.meters / 100) / 10} km</div>` : ''}</div></div>`;
    }).join('');
    const mapUrl = mapUrlForDay(trip, dayIndex);
    return `<section><div class="day-title"><div><span>Día ${dayIndex + 1}</span><h2>${escapeHtml(fmtDate(day.date))}</h2></div><b>${escapeHtml(day.zone || 'Día libre')}</b></div>${rows || '<p>Día libre, sin actividades.</p>'}${mapUrl ? `<a class="map-link" href="${escapeHtml(mapUrl)}">Abrir recorrido del día en el mapa</a>` : ''}</section>`;
  }).join('');

  const tickets = detail === 'complete' && trip.tickets.length
    ? `<section><h2>Tickets y reservas guardados</h2>${trip.tickets.map((ticket) => `<p><strong>${escapeHtml(ticket.title)}</strong>${ticket.provider ? ` · ${escapeHtml(ticket.provider)}` : ''}${ticket.note ? `<br><span class="meta">${escapeHtml(ticket.note)}</span>` : ''}</p>`).join('')}</section>`
    : '';

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{margin:28px}*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1D2733;margin:0;background:#fff;font-size:13px;line-height:1.45}.hero{background:#FAF8F4;border-radius:22px;padding:26px;border-top:8px solid #FF6B4A;margin-bottom:24px}.brand{color:#FF6B4A;font-weight:800;letter-spacing:.5px}.hero h1{font-size:30px;margin:5px 0}.hero p{margin:4px 0;color:#667085}section{break-inside:avoid;margin:0 0 22px;padding:20px;border:1px solid #E6E8EC;border-radius:18px}.day-title{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #E6E8EC;padding-bottom:12px;margin-bottom:12px}.day-title span{color:#16A085;font-weight:800}.day-title h2{margin:2px 0}.activity{display:flex;gap:14px;padding:11px 0;border-bottom:1px solid #F0F1F3}.activity:last-child{border:0}.time{font-weight:800;color:#FF6B4A;width:48px}.activity-body{flex:1}.meta{color:#667085;font-size:12px;margin-top:2px}.transfer{color:#147D6F;background:#E8F6F3;display:inline-block;padding:3px 8px;border-radius:20px;margin-top:7px;font-size:11px}.map-link{display:inline-block;margin-top:14px;color:#147D6F;font-weight:700}a{color:#147D6F}.footer{color:#667085;font-size:10px;text-align:center;margin-top:22px}
  </style></head><body><div class="hero"><div class="brand">RUMBO · ITINERARIO</div><h1>${escapeHtml(trip.cityName)}</h1><p>${escapeHtml(fmtRange(trip.startDate, trip.endDate))} · ${trip.days.length} días · ${trip.partySize ?? 1} viajero${(trip.partySize ?? 1) === 1 ? '' : 's'}</p><p>${trip.accommodation ? `Base: ${escapeHtml(trip.accommodation.name)} · ${escapeHtml(trip.accommodation.address ?? trip.accommodation.zone ?? '')}` : 'Alojamiento pendiente'}</p></div>${daySections}${tickets}<div class="footer">Generado con Rumbo. Verificá horarios, precios y disponibilidad en las fuentes oficiales.</div></body></html>`;
}

export async function createTripPdf(trip: Trip, detail: ExportDetail) {
  return Print.printToFileAsync({ html: tripExportHtml(trip, detail), base64: false });
}

export async function shareTripPdf(trip: Trip, detail: ExportDetail) {
  const result = await createTripPdf(trip, detail);
  if (Platform.OS === 'web') return { uri: result.uri, shared: false };
  if (!await Sharing.isAvailableAsync()) throw new Error('El menú para compartir no está disponible en este dispositivo.');
  await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf', dialogTitle: `Itinerario de ${trip.cityName}`, UTI: 'com.adobe.pdf' });
  return { uri: result.uri, shared: true };
}

function localDate(iso: string, minutes: number) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day, Math.floor(minutes / 60), minutes % 60);
}

function icsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsEscape(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

export function tripIcs(trip: Trip) {
  const events = trip.days.flatMap((day) => day.activities.map((activity) => {
    const place = placeById(activity.placeId);
    if (!place) return '';
    const start = localDate(day.date, activity.startMin);
    const end = new Date(start.getTime() + activity.durationMin * 60_000);
    return ['BEGIN:VEVENT', `UID:${activity.id}@rumbo.app`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`, `SUMMARY:${icsEscape(place.name)}`, `LOCATION:${icsEscape(place.address ?? place.zone)}`, `DESCRIPTION:${icsEscape(`${place.desc}${place.officialUrl ? `\n${place.officialUrl}` : ''}`)}`, 'END:VEVENT'].join('\r\n');
  })).filter(Boolean).join('\r\n');
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Rumbo//Travel Planner//ES\r\nCALSCALE:GREGORIAN\r\n${events}\r\nEND:VCALENDAR`;
}

export async function exportTripCalendar(trip: Trip) {
  if (Platform.OS === 'web') {
    const blob = new Blob([tripIcs(trip)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${slug(trip.cityName)}.ics`;
    anchor.click();
    URL.revokeObjectURL(url);
    return trip.days.reduce((count, day) => count + day.activities.length, 0);
  }

  const permission = await Calendar.requestCalendarPermissions(true);
  if (!permission.granted) throw new Error('Necesitamos permiso para agregar actividades a tu calendario.');
  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  const calendar = Platform.OS === 'ios'
    ? Calendar.getDefaultCalendarSync()
    : calendars.find((item) => item.allowsModifications && item.isPrimary) ?? calendars.find((item) => item.allowsModifications);
  if (!calendar) throw new Error('No encontramos un calendario editable en el dispositivo.');
  const timeZone = cityById(trip.cityId)?.timezone;
  let count = 0;
  for (const day of trip.days) {
    for (const activity of day.activities) {
      const place = placeById(activity.placeId);
      if (!place) continue;
      const startDate = localDate(day.date, activity.startMin);
      await calendar.createEvent({
        title: place.name,
        startDate,
        endDate: new Date(startDate.getTime() + activity.durationMin * 60_000),
        timeZone,
        location: place.address ?? place.zone,
        notes: place.desc,
        url: place.officialUrl,
        allDay: false,
      });
      count++;
    }
  }
  return count;
}

export async function shareCalendarFile(trip: Trip) {
  if (Platform.OS === 'web') return exportTripCalendar(trip);
  const file = new File(Paths.cache, `${slug(trip.cityName)}.ics`);
  file.create({ overwrite: true });
  file.write(tripIcs(trip));
  if (!await Sharing.isAvailableAsync()) throw new Error('No se puede compartir el calendario en este dispositivo.');
  await Sharing.shareAsync(file.uri, { mimeType: 'text/calendar', dialogTitle: `Calendario de ${trip.cityName}` });
  return file.uri;
}
