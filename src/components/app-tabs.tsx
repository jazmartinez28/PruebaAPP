import { Ionicons } from '@expo/vector-icons';
import { Tabs, TabList, TabSlot, TabTrigger, TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type IonName = keyof typeof Ionicons.glyphMap;

/** Alto base de la barra (sin contar el área segura inferior). */
export const TAB_BAR_HEIGHT = 64;

function useColors() {
  const scheme = useColorScheme();
  return Colors[scheme === 'dark' ? 'dark' : 'light'];
}

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        <TabBar>
          <TabTrigger name="index" href="/" asChild>
            <TabItem icon="home" iconOutline="home-outline" label="Inicio" />
          </TabTrigger>
          <TabTrigger name="viajes" href="/viajes" asChild>
            <TabItem icon="compass" iconOutline="compass-outline" label="Mis viajes" />
          </TabTrigger>
          <TabTrigger name="crear" href="/crear" asChild>
            <CreateItem />
          </TabTrigger>
          <TabTrigger name="perfil" href="/perfil" asChild>
            <TabItem icon="person" iconOutline="person-outline" label="Perfil" />
          </TabTrigger>
        </TabBar>
      </TabList>
    </Tabs>
  );
}

function TabBar({ children, style, ...props }: ViewProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      {...props}
      style={[
        styles.bar,
        {
          paddingBottom: Math.max(insets.bottom, Spacing.two),
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

type TabItemProps = TabTriggerSlotProps & {
  icon: IonName;
  iconOutline: IonName;
  label: string;
};

function TabItem({ icon, iconOutline, label, isFocused, ...props }: TabItemProps) {
  const colors = useColors();
  const color = isFocused ? colors.primary : colors.tabInactive;

  return (
    <Pressable {...props} style={styles.item} accessibilityRole="tab" accessibilityState={{ selected: !!isFocused }}>
      <Ionicons name={isFocused ? icon : iconOutline} size={24} color={color} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

function CreateItem({ isFocused, ...props }: TabTriggerSlotProps) {
  const colors = useColors();

  return (
    <Pressable {...props} style={styles.createItem} accessibilityRole="button" accessibilityLabel="Crear viaje">
      <View style={[styles.createButton, { backgroundColor: colors.primary, shadowColor: colors.primaryStrong }]}>
        <Ionicons name="add" size={30} color={colors.textOnPrimary} />
      </View>
      <Text style={[styles.label, { color: isFocused ? colors.primary : colors.tabInactive }]}>Crear</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: {
    height: '100%',
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: TAB_BAR_HEIGHT,
    paddingTop: Spacing.two,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 3,
    paddingTop: Spacing.one,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
  createItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  createButton: {
    width: 54,
    height: 54,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
