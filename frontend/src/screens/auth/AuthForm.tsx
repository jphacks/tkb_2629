import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ShadowInput } from '../../components/atoms/ShadowInput';
import { ActionButton } from '../../components/molecules/ActionButton';
import { BrandHeader } from '../../components/molecules/BrandHeader';
import { BackButton } from '../../components/molecules/BackButton';
import { GlassSurface } from '../../components/atoms/GlassSurface';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import { colors } from '../../theme/colors';
import type { Navigate } from '../types';

type Field<Key extends string> = { key: Key; label: string; password?: boolean; email?: boolean };
type Link = { label: string; onPress: () => void };
export function AuthForm<Key extends string>({ title, description, fields, submitLabel, submit, links = [], accountLayout = false, onBack, onNavigate }:
  { title: string; description?: string; fields: Field<Key>[]; submitLabel: string;
    submit: (values: Record<Key, string>) => Promise<string | void>; links?: Link[];
    accountLayout?: boolean; onBack?: () => void; onNavigate?: Navigate }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  async function handleSubmit() {
    if (busy) return;
    if (fields.some(field => !(values[field.key] ?? '').trim())) {
      setError(true); setMessage('すべての項目を入力してください'); return;
    }
    setBusy(true); setMessage(''); setError(false);
    // Build the submitted record only from the fields validated above.
    const submitted = Object.fromEntries(fields.map(field => [field.key, values[field.key] ?? ''])) as Record<Key, string>;
    try { setMessage((await submit(submitted)) ?? ''); }
    catch (cause) { setError(true); setMessage(cause instanceof Error ? cause.message : '通信に失敗しました'); }
    finally { setBusy(false); }
  }
  const FormSurface = accountLayout ? GlassSurface : View;
  return <ScreenFrame showNavigation={accountLayout} activeRoute={accountLayout ? 'account' : undefined}
    onNavigate={onNavigate} title={accountLayout ? title : undefined}
    headerLeading={accountLayout && onBack ? <BackButton onPress={onBack} disabled={busy} /> : undefined}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, accountLayout && styles.accountContent]}>
        {!accountLayout && <><BrandHeader /><Text style={styles.title}>{title}</Text></>}
        {description && <Text style={styles.description}>{description}</Text>}
        <FormSurface style={[styles.form, accountLayout && styles.accountForm]}>{fields.map(field => <View key={field.key}>
          <Text style={styles.label}>{field.label}</Text>
          <View style={styles.inputContainer}>
          <ShadowInput value={values[field.key] ?? ''} secureTextEntry={field.password ? !visiblePasswords[field.key] : false}
            autoCapitalize="none" autoCorrect={false} keyboardType={field.email ? 'email-address' : 'default'}
            editable={!busy} accessibilityLabel={field.label}
            onChangeText={value => setValues(previous => ({ ...previous, [field.key]: value }))}
            style={[styles.input, field.password && styles.passwordInput]} />
          {field.password && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${field.label}を${visiblePasswords[field.key] ? '隠す' : '表示する'}`}
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => setVisiblePasswords(previous => ({ ...previous, [field.key]: !previous[field.key] }))}
              style={({ pressed }) => [styles.visibilityButton, (pressed || busy) && styles.dimmed]}
            >
              <Ionicons name={visiblePasswords[field.key] ? 'eye-off-outline' : 'eye-outline'} size={24} color={colors.textSecondary} />
            </Pressable>
          )}
          </View>
        </View>)}</FormSurface>
        {!!message && <Text accessibilityRole="alert" style={[styles.message, error && styles.error]}>{message}</Text>}
        <ActionButton disabled={busy} label={busy ? '処理中…' : submitLabel} onPress={() => { void handleSubmit(); }} />
        {links.map(link => <View key={link.label} style={styles.link}><ActionButton secondary disabled={busy} {...link} /></View>)}
      </ScrollView>
    </KeyboardAvoidingView>
  </ScreenFrame>;
}
const styles = StyleSheet.create({
  accountContent: { paddingTop: 8, paddingBottom: 110 },
  accountForm: { backgroundColor: 'rgba(255, 255, 255, 0.48)', borderRadius: 16, padding: 16 },
  content: { padding: 24, paddingTop: 56, paddingBottom: 48 },
  title: { color: colors.text, fontSize: 26, fontWeight: '700', marginTop: 16 },
  description: { color: colors.placeholder, lineHeight: 22, marginTop: 12 },
  form: { gap: 16, marginVertical: 24 },
  label: { color: colors.text, fontSize: 14, marginBottom: 8 },
  input: { height: 54, width: '100%' },
  inputContainer: { position: 'relative' },
  passwordInput: { paddingRight: 56 },
  visibilityButton: { position: 'absolute', right: 3, top: 3, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  dimmed: { opacity: 0.5 },
  message: { color: colors.text, marginBottom: 16, lineHeight: 22 },
  error: { color: '#B42318' }, link: { marginTop: 16 },
});
