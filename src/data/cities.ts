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
  region: 'Europa' | 'América' | 'Asia' | 'África' | 'Oceanía';
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
    region: 'Europa',
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
    region: 'Europa',
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
    region: 'Europa',
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
    region: 'América',
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
    region: 'América',
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
    region: 'Asia',
  },
  {
    id: 'londres', name: 'Londres', country: 'Reino Unido', lat: 51.5074, lng: -0.1278,
    timezone: 'Europe/London', countryCode: 'GB', region: 'Europa',
    gradient: ['#667085', '#344054'], image: IMG('1513635269975-59663e0ac1ad'),
  },
  {
    id: 'madrid', name: 'Madrid', country: 'España', lat: 40.4168, lng: -3.7038,
    timezone: 'Europe/Madrid', countryCode: 'ES', region: 'Europa',
    gradient: ['#F79009', '#D92D20'], image: IMG('1539037116277-4db20889f2d4'),
  },
  {
    id: 'amsterdam', name: 'Ámsterdam', country: 'Países Bajos', lat: 52.3676, lng: 4.9041,
    timezone: 'Europe/Amsterdam', countryCode: 'NL', region: 'Europa',
    gradient: ['#2E90FA', '#175CD3'], image: IMG('1534351590666-13e3e96b5017'),
  },
  {
    id: 'lisboa', name: 'Lisboa', country: 'Portugal', lat: 38.7223, lng: -9.1393,
    timezone: 'Europe/Lisbon', countryCode: 'PT', region: 'Europa',
    gradient: ['#FDB022', '#F79009'], image: IMG('1555881400-74d7acaacd8b'),
  },
  {
    id: 'berlin', name: 'Berlín', country: 'Alemania', lat: 52.52, lng: 13.405,
    timezone: 'Europe/Berlin', countryCode: 'DE', region: 'Europa',
    gradient: ['#6172F3', '#3538CD'], image: IMG('1560969184-10fe8719e047'),
  },
  {
    id: 'viena', name: 'Viena', country: 'Austria', lat: 48.2082, lng: 16.3738,
    timezone: 'Europe/Vienna', countryCode: 'AT', region: 'Europa',
    gradient: ['#B692F6', '#7F56D9'], image: IMG('1516550893923-42d28e5677af'),
  },
  {
    id: 'praga', name: 'Praga', country: 'República Checa', lat: 50.0755, lng: 14.4378,
    timezone: 'Europe/Prague', countryCode: 'CZ', region: 'Europa',
    gradient: ['#53B1FD', '#1570EF'], image: IMG('1541849546-216549ae216d'),
  },
  {
    id: 'milan', name: 'Milán', country: 'Italia', lat: 45.4642, lng: 9.19,
    timezone: 'Europe/Rome', countryCode: 'IT', region: 'Europa',
    gradient: ['#98A2B3', '#475467'], image: IMG('1520440229-6469a149ac59'),
  },
  {
    id: 'venecia', name: 'Venecia', country: 'Italia', lat: 45.4408, lng: 12.3155,
    timezone: 'Europe/Rome', countryCode: 'IT', region: 'Europa',
    gradient: ['#36BFFA', '#0E7090'], image: IMG('1523906834658-6e24ef2386f9'),
  },
  {
    id: 'florencia', name: 'Florencia', country: 'Italia', lat: 43.7696, lng: 11.2558,
    timezone: 'Europe/Rome', countryCode: 'IT', region: 'Europa',
    gradient: ['#F97066', '#D92D20'], image: IMG('1541370976299-4d24ebbc9077'),
  },
  {
    id: 'atenas', name: 'Atenas', country: 'Grecia', lat: 37.9838, lng: 23.7275,
    timezone: 'Europe/Athens', countryCode: 'GR', region: 'Europa',
    gradient: ['#FDB022', '#DC6803'], image: IMG('1555993539-1732b0258235'),
  },
  {
    id: 'estambul', name: 'Estambul', country: 'Turquía', lat: 41.0082, lng: 28.9784,
    timezone: 'Europe/Istanbul', countryCode: 'TR', region: 'Europa',
    gradient: ['#F97066', '#C01048'], image: IMG('1524231757912-21f4fe3a7200'),
  },
  {
    id: 'dubai', name: 'Dubái', country: 'Emiratos Árabes Unidos', lat: 25.2048, lng: 55.2708,
    timezone: 'Asia/Dubai', countryCode: 'AE', region: 'Asia',
    gradient: ['#FEC84B', '#B54708'], image: IMG('1512453979798-5ea266f8880c'),
  },
  {
    id: 'singapur', name: 'Singapur', country: 'Singapur', lat: 1.3521, lng: 103.8198,
    timezone: 'Asia/Singapore', countryCode: 'SG', region: 'Asia',
    gradient: ['#32D583', '#027A48'], image: IMG('1525625293386-3f8f99389edd'),
  },
  {
    id: 'bangkok', name: 'Bangkok', country: 'Tailandia', lat: 13.7563, lng: 100.5018,
    timezone: 'Asia/Bangkok', countryCode: 'TH', region: 'Asia',
    gradient: ['#FEC84B', '#F04438'], image: IMG('1508009603885-50cf7c579365'),
  },
  {
    id: 'seul', name: 'Seúl', country: 'Corea del Sur', lat: 37.5665, lng: 126.978,
    timezone: 'Asia/Seoul', countryCode: 'KR', region: 'Asia',
    gradient: ['#7F56D9', '#444CE7'], image: IMG('1538485399081-7c8970e65c95'),
  },
  {
    id: 'hongkong', name: 'Hong Kong', country: 'China', lat: 22.3193, lng: 114.1694,
    timezone: 'Asia/Hong_Kong', countryCode: 'HK', region: 'Asia',
    gradient: ['#F04438', '#912018'], image: IMG('1536599018102-9f803c140fc1'),
  },
  {
    id: 'sidney', name: 'Sídney', country: 'Australia', lat: -33.8688, lng: 151.2093,
    timezone: 'Australia/Sydney', countryCode: 'AU', region: 'Oceanía',
    gradient: ['#36BFFA', '#1570EF'], image: IMG('1506973035872-a4ec16b8e8d9'),
  },
  {
    id: 'losangeles', name: 'Los Ángeles', country: 'Estados Unidos', lat: 34.0522, lng: -118.2437,
    timezone: 'America/Los_Angeles', countryCode: 'US', region: 'América',
    gradient: ['#F79009', '#F04438'], image: IMG('1534190760961-74e8c1c5c3da'),
  },
  {
    id: 'sanfrancisco', name: 'San Francisco', country: 'Estados Unidos', lat: 37.7749, lng: -122.4194,
    timezone: 'America/Los_Angeles', countryCode: 'US', region: 'América',
    gradient: ['#F97066', '#B42318'], image: IMG('1501594907352-04cda38ebc29'),
  },
  {
    id: 'mexico', name: 'Ciudad de México', country: 'México', lat: 19.4326, lng: -99.1332,
    timezone: 'America/Mexico_City', countryCode: 'MX', region: 'América',
    gradient: ['#32D583', '#B54708'], image: IMG('1518659526054-190340b32735'),
  },
  {
    id: 'rio', name: 'Río de Janeiro', country: 'Brasil', lat: -22.9068, lng: -43.1729,
    timezone: 'America/Sao_Paulo', countryCode: 'BR', region: 'América',
    gradient: ['#32D583', '#1570EF'], image: IMG('1483729558449-99ef09a8c325'),
  },
  {
    id: 'ciudaddelcabo', name: 'Ciudad del Cabo', country: 'Sudáfrica', lat: -33.9249, lng: 18.4241,
    timezone: 'Africa/Johannesburg', countryCode: 'ZA', region: 'África',
    gradient: ['#2ED3B7', '#175CD3'], image: IMG('1580060839134-75a5edca2e99'),
  },
  {
    id: 'marrakech', name: 'Marrakech', country: 'Marruecos', lat: 31.6295, lng: -7.9811,
    timezone: 'Africa/Casablanca', countryCode: 'MA', region: 'África',
    gradient: ['#F97066', '#B54708'], image: IMG('1597212618440-806262de4f6b'),
  },
];

export const cityById = (id: string) => CITIES.find((city) => city.id === id);
