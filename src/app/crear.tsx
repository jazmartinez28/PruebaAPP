import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Card, H1, Screen } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const NEEDS = [
  { icon: 'location-outline', text: 'A dónde vas' },
  { icon: 'calendar-outline', text: 'Cuándo (fechas)' },
  { icon: 'heart-outline', text: 'Qué te gusta hacer' },
] as const;

export default function CrearScreen() {
  const t = useTheme();

  return (
    <Screen>
      <H1>Crear viaje</H1>
      <Body muted>Te vamos a hacer unas pocas preguntas y armamos tu itinerario.</Body>

      <Card style={{ gap: Spacing.three }}>
        <Body style={{ fontWeight: '700' }}>Vas a necesitar</Body>
        {NEEDS.map((n) => (
          <View key={n.text} style={styles.row}>
            <View style={[styles.icon, { backgroundColor: t.secondarySoft }]}>
              <Ionicons name={n.icon as any} size={20} color={t.secondary} />
            </View>
            <Body>{n.text}</Body>
          </View>
        ))}
        <Body muted style={{ fontSize: 13 }}>
          El alojamiento y los lugares imprescindibles son opcionales: los podés agregar después.
        </Body>
      </Card>

      <Button title="Empezar" icon="arrow-forward" onPress={() => { /* TODO: flujo de 8 pasos */ }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  icon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
});
