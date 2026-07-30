import type { Place } from '@/types';

const CURATED_BOOKING_URLS: Record<string, string> = {
  'roma-coliseo': 'https://ticketing.colosseo.it/',
  'roma-vaticano': 'https://tickets.museivaticani.va/',
  'roma-borghese': 'https://galleriaborghese.beniculturali.it/',
  'paris-torre': 'https://ticket.toureiffel.paris/',
  'paris-louvre': 'https://www.ticketlouvre.fr/',
  'paris-orsay': 'https://billetterie.musee-orsay.fr/',
  'bcn-sagrada': 'https://sagradafamilia.org/tickets',
  'bcn-guell': 'https://parkguell.barcelona/',
  'bcn-batllo': 'https://www.casabatllo.es/online-tickets/',
  'ba-colon': 'https://teatrocolon.org.ar/',
  'ny-empire': 'https://www.esbnyc.com/buy-tickets',
  'ny-libertad': 'https://www.cityexperiences.com/new-york/city-cruises/statue/',
  'ny-moma': 'https://www.moma.org/tickets/',
  'ny-metmuseum': 'https://engage.metmuseum.org/admission',
  'tk-skytree': 'https://www.tokyo-skytree.jp/en/ticket/',
  'tk-teamlab': 'https://teamlabplanets.dmm.com/en/ticket',
};

export function purchaseUrlFor(place: Place): string | undefined {
  return place.bookingUrl || CURATED_BOOKING_URLS[place.id] || place.officialUrl;
}
