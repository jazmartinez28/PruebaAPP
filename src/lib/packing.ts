import type { PackingCategory, PackingItem, Trip } from '@/types';

export const PACKING_CATEGORIES: Record<PackingCategory, { label: string; icon: any; color: string }> = {
  ropa: { label: 'Ropa', icon: 'shirt-outline', color: '#7C5CE7' },
  documentacion: { label: 'Documentación', icon: 'document-text-outline', color: '#B36A19' },
  higiene: { label: 'Higiene', icon: 'water-outline', color: '#23866B' },
  tecnologia: { label: 'Tecnología', icon: 'phone-portrait-outline', color: '#4254A7' },
  medicamentos: { label: 'Medicamentos', icon: 'medkit-outline', color: '#D92D20' },
  otros: { label: 'Otros', icon: 'apps-outline', color: '#667085' },
};

export function seasonalClimateLabel(trip: Trip) {
  const month = new Date(`${trip.startDate}T12:00:00`).getMonth();
  const southern = trip.cityId === 'buenosaires';
  const summer = southern ? month >= 11 || month <= 2 : month >= 5 && month <= 8;
  const winter = southern ? month >= 5 && month <= 8 : month === 11 || month <= 1;
  if (summer) return { label: 'Época cálida · ropa liviana y protección solar', icon: 'sunny-outline' as const };
  if (winter) return { label: 'Época fría · conviene vestirse por capas', icon: 'snow-outline' as const };
  return { label: 'Entretiempo · llevá una capa impermeable', icon: 'rainy-outline' as const };
}

const item = (id: string, label: string, category: PackingCategory): PackingItem => ({
  id: `suggested-${id}`,
  label,
  category,
  packed: false,
  suggested: true,
});

export function packingSuggestions(trip: Trip): PackingItem[] {
  const days = Math.max(1, trip.days.length);
  const month = new Date(`${trip.startDate}T12:00:00`).getMonth();
  const southern = trip.cityId === 'buenosaires';
  const summer = southern ? month >= 11 || month <= 2 : month >= 5 && month <= 8;
  const winter = southern ? month >= 5 && month <= 8 : month === 11 || month <= 1;
  const base = [
    item('documento', 'Documento o pasaporte', 'documentacion'),
    item('reservas', 'Reservas y tickets descargados', 'documentacion'),
    item('cargador', 'Cargador y batería portátil', 'tecnologia'),
    item('medicacion', 'Medicación personal', 'medicamentos'),
    item('higiene', 'Neceser de higiene', 'higiene'),
    item('calzado', 'Calzado cómodo para caminar', 'ropa'),
  ];
  if (days >= 5) base.push(item('lavado', 'Bolsa para ropa usada', 'ropa'));
  if (trip.cityId === 'tokio' || trip.cityId === 'nuevayork') base.push(item('adaptador', 'Adaptador universal', 'tecnologia'));
  if (trip.cityId === 'roma' || trip.cityId === 'barcelona' || trip.cityId === 'buenosaires') {
    base.push(item('sol', 'Protector solar y lentes', 'higiene'));
  }
  if (summer) base.push(item('calor', 'Ropa liviana y botella reutilizable', 'ropa'));
  if (winter) base.push(item('abrigo', 'Abrigo por capas', 'ropa'));
  if (!summer && !winter) base.push(item('lluvia', 'Piloto o paraguas compacto', 'ropa'));
  return base;
}
