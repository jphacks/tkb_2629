import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ShadowInput } from '../../components/atoms/ShadowInput';
import { ActionButton } from '../../components/molecules/ActionButton';
import { BrandHeader } from '../../components/molecules/BrandHeader';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import { colors } from '../../theme/colors';

type Field<Key extends string> = { key: Key; label: string; password?: boolean; email?: boolean };
type Link = { label: string; onPress: () => void };
export function AuthForm<Key extends string>({ title, description, fields, submitLabel, submit, links = [] }:
  { title: string; description?: string; fields: Field<Key>[]; submitLabel: string;
    submit: (values: Record<Key, string>) => Promise<string | void>; links?: Link[] }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
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
  return <ScreenFrame showNavigation={false}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <BrandHeader /><Text style={styles.title}>{title}</Text>
        {description && <Text style={styles.description}>{description}</Text>}
        <View style={styles.form}>{fields.map(field => <View key={field.key}>
          <Text style={styles.label}>{field.label}</Text>
          <ShadowInput value={values[field.key] ?? ''} secureTextEntry={field.password}
            autoCapitalize="none" autoCorrect={false} keyboardType={field.email ? 'email-address' : 'default'}
            editable={!busy} accessibilityLabel={field.label}
            onChangeText={value => setValues(previous => ({ ...previous, [field.key]: value }))}
            style={styles.input} />
        </View>)}</View>
        {!!message && <Text accessibilityRole="alert" style={[styles.message, error && styles.error]}>{message}</Text>}
        <ActionButton disabled={busy} label={busy ? '処理中…' : submitLabel} onPress={() => { void handleSubmit(); }} />
        {links.map(link => <View key={link.label} style={styles.link}><ActionButton secondary disabled={busy} {...link} /></View>)}
      </ScrollView>
    </KeyboardAvoidingView>
  </ScreenFrame>;
}
const styles = StyleSheet.create({
  content: { padding: 24, paddingTop: 56, paddingBottom: 48 },
  title: { color: colors.text, fontSize: 26, fontWeight: '700', marginTop: 16 },
  description: { color: colors.placeholder, lineHeight: 22, marginTop: 12 },
  form: { gap: 16, marginVertical: 24 },
  label: { color: colors.text, fontSize: 14, marginBottom: 8 },
  input: { height: 54, width: '100%' },
  message: { color: colors.text, marginBottom: 16, lineHeight: 22 },
  error: { color: '#B42318' }, link: { marginTop: 16 },
});
