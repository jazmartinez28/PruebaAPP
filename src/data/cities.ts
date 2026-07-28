export type City = {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  gradient: [string, string];
  emoji: string;
};

export const CITIES: City[] = [
  { id: 'roma', name: 'Roma', country: 'Italia', lat: 41.9028, lng: 12.4964, gradient: ['#FF8A5B', '#F2542D'], emoji: '🏛️' },
  { id: 'paris', name: 'París', country: 'Francia', lat: 48.8566, lng: 2.3522, gradient: ['#6A85F1', '#3B5BDB'], emoji: '🗼' },
  { id: 'barcelona', name: 'Barcelona', country: 'España', lat: 41.3874, lng: 2.1686, gradient: ['#F6A821', '#E8590C'], emoji: '⛪' },
  { id: 'buenosaires', name: 'Buenos Aires', country: 'Argentina', lat: -34.6037, lng: -58.3816, gradient: ['#4DD4C0', '#1098AD'], emoji: '💃' },
  { id: 'nuevayork', name: 'Nueva York', country: 'Estados Unidos', lat: 40.7128, lng: -74.006, gradient: ['#5C7CFA', '#3B5BDB'], emoji: '🗽' },
  { id: 'tokio', name: 'Tokio', country: 'Japón', lat: 35.6762, lng: 139.6503, gradient: ['#FF6B9D', '#C9184A'], emoji: '🗾' },
];

export const cityById = (id: string) => CITIES.find((c) => c.id === id);
