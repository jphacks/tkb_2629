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
        setState({ status: 'error', message: reason instanceof Error ? reason.message : '公開プロフィールの取得に失敗しました。' });
      }
    });
    return () => { active = false; };
  }, [version]);

  async function save() {
    if (locked.current || state.status !== 'ready') return;
    const normalized = name.trim();
    if (Array.from(normalized).length < 1 || Array.from(normalized).length > 100) {
      setError('公開用表示名は前後の空白を除いて1〜100文字で入力してください。');
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
      setMessage('公開用表示名を保存しました。');
    } catch (reason) {
      if (mounted.current) {
        setError(reason instanceof Error ? reason.message : '公開用表示名の保存に失敗しました。');
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
      title="公開プロフィール"
      showNavigation={!busy}
      headerLeading={<BackButton disabled={busy} onPress={onBack ?? (() => onNavigate('account-settings'))} />}
    >
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.description}>他の読者への表示に使う名前です。登録時のユーザー名とは別に設定し、登録名やメールアドレスは自動で使いません。</Text>
          <Text style={styles.description}>現在は表示名を保存する段階です。他の読者へのプロフィール・感想の表示は準備中です。</Text>
          {state.status === 'loading' && <Text style={styles.description}>公開プロフィールを読み込んでいます…</Text>}
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
                  <Text style={styles.previewLabel}>公開プロフィールの表示イメージ</Text>
                  <Text style={styles.displayName}>{state.savedName ?? '表示名は未設定'}</Text>
                </View>
              </View>
              <Text style={styles.description}>{state.savedName === null ? '公開用表示名は未設定です。' : `保存済みの表示名：${state.savedName}`}</Text>
              <View style={styles.field}>
                <FieldLabel>公開用表示名</FieldLabel>
                <ShadowInput
                  accessibilityLabel="公開用表示名"
                  placeholder="公開用表示名を入力"
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
              <ActionButton disabled={busy} label={busy ? '保存中…' : error ? '再度保存する' : '表示名を保存する'} onPress={() => { void save(); }} />
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
