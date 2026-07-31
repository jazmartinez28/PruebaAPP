import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Body, Button, H2, Label } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PACKING_CATEGORIES, packingSuggestions } from '@/lib/packing';
import { useStore } from '@/store/useStore';
import type { PackingCategory, Trip } from '@/types';

export function PackingList({ trip }: { trip: Trip }) {
  const t = useTheme();
  const add = useStore((s) => s.addPackingItem);
  const update = useStore((s) => s.updatePackingItem);
  const remove = useStore((s) => s.removePackingItem);
  const addSuggestions = useStore((s) => s.addPackingSuggestions);
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<PackingCategory>('ropa');
  const [editing, setEditing] = useState<string | null>(null);
  const items = trip.packingItems ?? [];
  const packed = items.filter((item) => item.packed).length;
  const progress = items.length ? packed / items.length : 0;
  const grouped = useMemo(
    () =>
      (Object.keys(PACKING_CATEGORIES) as PackingCategory[])
        .map((key) => ({ key, items: items.filter((item) => item.category === key) }))
        .filter((group) => group.items.length),
    [items],
  );

  const submit = () => {
    if (!label.trim()) return;
    if (editing) update(trip.id, editing, { label: label.trim(), category });
    else add(trip.id, label, category);
    setLabel('');
    setEditing(null);
  };

  return (
    <View style={{ gap: Spacing.four }}>
      <View>
        <H2>Prepará tu viaje sin olvidarte de nada</H2>
        <Body muted style={{ marginTop: 4 }}>
          {packed} de {items.length} elementos preparados
        </Body>
        <View style={[styles.progressTrack, { backgroundColor: t.border }]}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: t.secondary }]} />
        </View>
      </View>

      {!items.length && (
        <View style={[styles.empty, { backgroundColor: t.secondarySoft }]}>
          <View style={[styles.emptyIcon, { backgroundColor: t.secondary }]}>
            <Ionicons name="bag-check-outline" size={27} color="#fff" />
          </View>
          <Body style={{ color: t.secondary, fontWeight: '900', fontSize: 17 }}>Tu valija empieza acá</Body>
          <Body style={{ color: t.secondary, textAlign: 'center', fontSize: 13 }}>
            Creamos sugerencias según {trip.cityName}, la duración y el clima estacional esperado.
          </Body>
          <Button
            title="Agregar sugerencias"
            icon="sparkles-outline"
            size="md"
            variant="secondary"
            onPress={() => addSuggestions(trip.id, packingSuggestions(trip))}
          />
        </View>
      )}

      <View style={[styles.composer, { backgroundColor: t.surface, borderColor: t.border }]}>
        <Label>{editing ? 'Editar elemento' : 'Agregar a la valija'}</Label>
        <View style={styles.inputRow}>
          <TextInput
            accessibilityLabel="Elemento para llevar"
            value={label}
            onChangeText={setLabel}
            onSubmitEditing={submit}
            placeholder="Ej. campera liviana"
            placeholderTextColor={t.textSecondary}
            style={[styles.input, { color: t.text, backgroundColor: t.background, borderColor: t.border }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={editing ? 'Guardar cambio' : 'Agregar elemento'}
            disabled={!label.trim()}
            onPress={submit}
            style={({ pressed }) => [
              styles.addButton,
              { backgroundColor: t.primary, opacity: label.trim() ? 1 : 0.4 },
              pressed && { opacity: 0.78 },
            ]}>
            <Ionicons name={editing ? 'checkmark' : 'add'} size={23} color="#fff" />
          </Pressable>
        </View>
        <View style={styles.categoryRail}>
          {(Object.keys(PACKING_CATEGORIES) as PackingCategory[]).map((key) => {
            const meta = PACKING_CATEGORIES[key];
            const selected = category === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setCategory(key)}
                style={[
                  styles.categoryChip,
                  { backgroundColor: selected ? `${meta.color}18` : t.background, borderColor: selected ? meta.color : t.border },
                ]}>
                <Ionicons name={meta.icon} size={15} color={selected ? meta.color : t.textSecondary} />
                <Body style={{ fontSize: 11, fontWeight: '800', color: selected ? meta.color : t.textSecondary }}>
                  {meta.label}
                </Body>
              </Pressable>
            );
          })}
        </View>
      </View>

      {grouped.map((group) => {
        const meta = PACKING_CATEGORIES[group.key];
        return (
          <View key={group.key} style={{ gap: Spacing.two }}>
            <View style={styles.groupTitle}>
              <View style={[styles.groupIcon, { backgroundColor: `${meta.color}18` }]}>
                <Ionicons name={meta.icon} size={18} color={meta.color} />
              </View>
              <Body style={{ fontWeight: '900' }}>{meta.label}</Body>
              <Body muted style={{ marginLeft: 'auto', fontSize: 12 }}>
                {group.items.filter((item) => item.packed).length}/{group.items.length}
              </Body>
            </View>
            {group.items.map((item) => (
              <View key={item.id} style={[styles.item, { backgroundColor: t.surface, borderColor: t.border }]}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: item.packed }}
                  accessibilityLabel={`${item.label}, ${item.packed ? 'preparado' : 'pendiente'}`}
                  onPress={() => update(trip.id, item.id, { packed: !item.packed })}
                  style={[styles.check, { borderColor: item.packed ? t.secondary : t.border, backgroundColor: item.packed ? t.secondary : t.surface }]}>
                  {item.packed && <Ionicons name="checkmark" size={17} color="#fff" />}
                </Pressable>
                <Body style={[styles.itemLabel, item.packed && { color: t.textSecondary, textDecorationLine: 'line-through' }]}>
                  {item.label}
                </Body>
                {item.suggested && <Ionicons name="sparkles-outline" size={16} color={t.warning} />}
                <Pressable
                  accessibilityLabel={`Editar ${item.label}`}
                  hitSlop={8}
                  onPress={() => { setEditing(item.id); setLabel(item.label); setCategory(item.category); }}>
                  <Ionicons name="pencil-outline" size={18} color={t.textSecondary} />
                </Pressable>
                <Pressable accessibilityLabel={`Eliminar ${item.label}`} hitSlop={8} onPress={() => remove(trip.id, item.id)}>
                  <Ionicons name="trash-outline" size={18} color={t.error} />
                </Pressable>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 13 },
  progressFill: { height: 8, borderRadius: 4 },
  empty: { alignItems: 'center', gap: 9, borderRadius: Radius.lg, padding: Spacing.four },
  emptyIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  composer: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.two },
  inputRow: { flexDirection: 'row', gap: Spacing.two },
  input: { flex: 1, minHeight: 50, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 14, fontSize: 15 },
  addButton: { width: 50, height: 50, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  categoryRail: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  categoryChip: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: 10 },
  groupTitle: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9 },
  groupIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  item: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 12 },
  check: { width: 28, height: 28, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  itemLabel: { flex: 1, fontWeight: '700' },
});
