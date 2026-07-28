import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, H1 } from '@/components/ui';
import { APP_NAME } from '@/constants/config';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/store/useStore';

export default function AuthScreen() {
  const t = useTheme();
  const router = useRouter();
  const signup = useStore((s) => s.signup);
  const login = useStore((s) => s.login);

  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    const res = mode === 'signup' ? signup(name, email, password) : login(email, password);
    if (res.ok) router.back();
    else setError(res.error ?? 'Algo salió mal.');
  };

  const Field = ({ icon, ...props }: any) => (
    <View style={[styles.field, { backgroundColor: t.surface, borderColor: t.border }]}>
      <Ionicons name={icon} size={18} color={t.textSecondary} />
      <TextInput placeholderTextColor={t.textSecondary} style={{ flex: 1, color: t.text, fontSize: 15 }} {...props} />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.background }}>
      <View style={{ alignItems: 'flex-end', padding: Spacing.three }}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={t.textSecondary} />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: Spacing.four, gap: Spacing.three, flex: 1 }}>
        <H1>{mode === 'signup' ? `Creá tu cuenta en ${APP_NAME}` : 'Bienvenido de nuevo'}</H1>
        <Body muted>{mode === 'signup' ? 'Para guardar y sincronizar tus viajes.' : 'Iniciá sesión para ver tus viajes.'}</Body>

        <View style={{ gap: Spacing.two, marginTop: Spacing.two }}>
          {mode === 'signup' && <Field icon="person-outline" placeholder="Tu nombre" value={name} onChangeText={setName} />}
          <Field icon="mail-outline" placeholder="Correo electrónico" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <Field icon="lock-closed-outline" placeholder="Contraseña" secureTextEntry value={password} onChangeText={setPassword} />
        </View>

        {error && (
          <View style={[styles.error, { backgroundColor: t.error + '18' }]}>
            <Ionicons name="alert-circle" size={16} color={t.error} />
            <Body style={{ color: t.error, flex: 1, fontSize: 13 }}>{error}</Body>
          </View>
        )}

        <Button title={mode === 'signup' ? 'Crear cuenta' : 'Iniciar sesión'} icon="arrow-forward" onPress={submit} style={{ marginTop: Spacing.two }} />

        <Pressable onPress={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(null); }} style={{ alignSelf: 'center', padding: Spacing.two }}>
          <Body style={{ color: t.primary, fontWeight: '600' }}>
            {mode === 'signup' ? '¿Ya tenés cuenta? Iniciá sesión' : '¿No tenés cuenta? Registrate'}
          </Body>
        </Pressable>
      </View>

      <Body muted style={{ textAlign: 'center', fontSize: 11, padding: Spacing.three }}>
        Cuenta local de demostración. Se integrará con inicio de sesión real (Google / Apple / Supabase).
      </Body>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.three, paddingVertical: 13 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: Spacing.two, borderRadius: Radius.sm },
});
