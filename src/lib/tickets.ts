import type { Place } from '@/types';

export type TicketStatus =
  | 'none' // no requiere ticket (plaza, paseo)
  | 'free' // entrada gratuita
  | 'reservation' // restaurante: conviene reservar
  | 'recommended' // ticket recomendado (museo con reserva)
  | 'required' // ticket obligatorio (evento, partido)
  | 'paid' // entrada paga (se compra en puerta)
  | 'unconfirmed'; // información sin confirmar

export type TicketInfo = {
  status: TicketStatus;
  label: string;
  ticket: boolean; // true si realmente hace falta una entrada
  reservation: boolean; // true si conviene reservar (sin ticket)
};

/**
 * Deriva el estado de ticket real de un lugar a partir de sus datos.
 * Evita transmitir que "todo necesita entrada".
 */
export function ticketInfo(place: Place): TicketInfo {
  const isEvent = place.categories.includes('deportes') || place.categories.includes('musica');

  if (place.isMeal) {
    return place.needsBooking
      ? { status: 'reservation', label: 'Reserva recomendada', ticket: false, reservation: true }
      : { status: 'none', label: 'No requiere ticket', ticket: false, reservation: false };
  }
  if (place.price === 0) {
    return { status: 'free', label: 'Entrada gratuita', ticket: false, reservation: false };
  }
  if (place.confident === false) {
    return { status: 'unconfirmed', label: 'Ticket sin confirmar', ticket: true, reservation: false };
  }
  if (isEvent) {
    return { status: 'required', label: 'Requiere ticket', ticket: true, reservation: false };
  }
  if (place.needsBooking) {
    return { status: 'recommended', label: 'Ticket recomendado', ticket: true, reservation: false };
  }
  return { status: 'paid', label: 'Entrada paga', ticket: true, reservation: false };
}
