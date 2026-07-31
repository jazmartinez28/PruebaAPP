export type City = {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  timezone: string;
  countryCode: string;
  gradient: [string, string];
  image: string;
};

const IMG = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=78`;

export const CITIES: City[] = [
  {
    id: 'roma',
    name: 'Roma',
    country: 'Italia',
    lat: 41.9028,
    lng: 12.4964,
    timezone: 'Europe/Rome',
    countryCode: 'IT',
    gradient: ['#FF8A5B', '#F2542D'],
    image: IMG('1552832230-c0197dd311b5'),
  },
  {
    id: 'paris',
    name: 'París',
    country: 'Francia',
    lat: 48.8566,
    lng: 2.3522,
    timezone: 'Europe/Paris',
    countryCode: 'FR',
    gradient: ['#6A85F1', '#3B5BDB'],
    image: IMG('1502602898657-3e91760cbb34'),
  },
  {
    id: 'barcelona',
    name: 'Barcelona',
    country: 'España',
    lat: 41.3874,
    lng: 2.1686,
    timezone: 'Europe/Madrid',
    countryCode: 'ES',
    gradient: ['#F6A821', '#E8590C'],
    image: IMG('1583422409516-2895a77efded'),
  },
  {
    id: 'buenosaires',
    name: 'Buenos Aires',
    country: 'Argentina',
    lat: -34.6037,
    lng: -58.3816,
    timezone: 'America/Argentina/Buenos_Aires',
    countryCode: 'AR',
    gradient: ['#4DD4C0', '#1098AD'],
    image: IMG('1612294037637-ec328d0e075e'),
  },
  {
    id: 'nuevayork',
    name: 'Nueva York',
    country: 'Estados Unidos',
    lat: 40.7128,
    lng: -74.006,
    timezone: 'America/New_York',
    countryCode: 'US',
    gradient: ['#5C7CFA', '#3B5BDB'],
    image: IMG('1496442226666-8d4d0e62e6e9'),
  },
  {
    id: 'tokio',
    name: 'Tokio',
    country: 'Japón',
    lat: 35.6762,
    lng: 139.6503,
    timezone: 'Asia/Tokyo',
    countryCode: 'JP',
    gradient: ['#FF6B9D', '#C9184A'],
    image: IMG('1540959733332-eab4deabeeaf'),
  },
];

export const cityById = (id: string) => CITIES.find((city) => city.id === id);
