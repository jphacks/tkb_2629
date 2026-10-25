import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { FieldLabel } from '../../components/atoms/FieldLabel';
import { ShadowInput } from '../../components/atoms/ShadowInput';
import { ActionButton } from '../../components/molecules/ActionButton';
import { BackButton } from '../../components/molecules/BackButton';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import { getPublicProfile, savePublicDisplayName } from '../../lib/api';
import { colors } from '../../theme/colors';
import type { Navigate } from '../types';

type ProfileState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; savedName: string | null };

export function PublicProfileScreen({ onNavigate, onBack }: { onNavigate: Navigate; onBack?: () => void }) {
  const [state, setState] = useState<ProfileState>({ status: 'loading' });
  const [name, setName] = useState('');
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const mounted = useRef(false);
  const locked = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    getPublicProfile().then((profile) => {
      if (!active) return;
      setName(profile.public_display_name ?? '');
      setState({ status: 'ready', savedName: profile.public_display_name });
    }).catch((reason: unknown) => {
      if (active) {
        setState({ status: 'error', message: reason instanceof Error ? reason.message : '名前の取得に失敗しました。' });
      }
    });
    return () => { active = false; };
  }, [version]);

  async function save() {
    if (locked.current || state.status !== 'ready') return;
    const normalized = name.trim();
    if (Array.from(normalized).length < 1 || Array.from(normalized).length > 100) {
      setError('名前は前後の空白を除いて1〜100文字で入力してください。');
      setMessage(null);
      return;
    }
    locked.current = true;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const profile = await savePublicDisplayName(normalized);
      if (!mounted.current) return;
      setState({ status: 'ready', savedName: profile.public_display_name });
      setName(profile.public_display_name ?? '');
      setMessage('名前を保存しました。');
    } catch (reason) {
      if (mounted.current) {
        setError(reason instanceof Error ? reason.message : '名前の保存に失敗しました。');
      }
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <ScreenFrame
      activeRoute="account"
      onNavigate={onNavigate}
      title="名前"
      showNavigation={!busy}
      headerLeading={<BackButton disabled={busy} onPress={onBack ?? (() => onNavigate('account-settings'))} />}
    >
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.description}>アカウントと公開した感想に使う名前です。他の読者にも表示されます。本名でなくても構いません。</Text>
          <Text style={styles.description}>未設定の場合、以前の登録名は自動公開しません。ここで名前を保存するまで、公開感想の一覧には掲載されません。</Text>
          {state.status === 'loading' && <Text style={styles.description}>名前を読み込んでいます…</Text>}
          {state.status === 'error' && (
            <>
              <Text accessibilityRole="alert" style={styles.error}>{state.message}</Text>
              <ActionButton label="読み込みを再試行" onPress={() => setVersion((value) => value + 1)} />
            </>
          )}
          {state.status === 'ready' && (
            <>
              <View style={styles.preview}>
                <View accessibilityRole="image" accessibilityLabel="本のデフォルトアイコン" style={styles.avatar}>
                  <Ionicons accessible={false} name="book-outline" size={32} color={colors.navAccent} />
                </View>
                <View style={styles.previewCopy}>
                  <Text style={styles.previewLabel}>他の読者への表示</Text>
                  <Text style={styles.displayName}>{state.savedName ?? '名前は未設定'}</Text>
                </View>
              </View>
              <Text style={styles.description}>{state.savedName === null ? '名前は未設定です。' : `保存済みの名前：${state.savedName}`}</Text>
              <View style={styles.field}>
                <FieldLabel>名前</FieldLabel>
                <ShadowInput
                  accessibilityLabel="名前（他の読者にも表示）"
                  placeholder="名前を入力"
                  value={name}
                  editable={!busy}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={(value) => { setName(value); setError(null); setMessage(null); }}
                  style={styles.input}
                />
                <Text style={styles.description}>前後の空白を除いて1〜100文字。同じ名前を他の読者も使えます。保存後も変更できますが、未設定には戻せません。</Text>
              </View>
              {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
              {message && <Text accessibilityRole="alert" style={styles.description}>{message}</Text>}
              <ActionButton disabled={busy} label={busy ? '保存中…' : error ? '再度保存する' : '名前を保存する'} onPress={() => { void save(); }} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 110, gap: 20 },
  description: { color: colors.text, fontSize: 14, lineHeight: 22 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F0EAF2', alignItems: 'center', justifyContent: 'center' },
  previewCopy: { flex: 1, gap: 6 },
  previewLabel: { color: colors.textSecondary, fontSize: 12 },
  displayName: { color: colors.text, fontSize: 20, fontWeight: '700', flexShrink: 1 },
  field: { gap: 8 },
  input: { minHeight: 54, width: '100%' },
  error: { color: '#B42318', fontSize: 14, lineHeight: 22 },
});
