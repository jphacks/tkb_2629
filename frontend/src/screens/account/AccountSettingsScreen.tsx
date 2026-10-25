import { useState } from 'react';
import { currentUser, logout } from '../../lib/auth';
import { colors } from "../../theme/colors";
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { SettingsRow } from '../../components/molecules/SettingsRow';
import { GlassSurface } from '../../components/atoms/GlassSurface';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import type { Navigate } from '../types';

export function AccountSettingsScreen({ onNavigate }: { onNavigate: Navigate }) {
  const user = currentUser();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function handleLogout() {
    if (busy) return;
    setBusy(true); setError('');
    try { await logout(); onNavigate('login'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'ログアウトに失敗しました'); }
    finally { setBusy(false); }
  }
  return (
    <ScreenFrame activeRoute="account" onNavigate={onNavigate} title="アカウント設定">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.notice}>名前は他の読者にも表示されます。メールアドレスの変更は準備中です。</Text>
        <Text style={styles.section}>アカウント情報</Text>
        <GlassSurface style={styles.group}>
          <SettingsRow label="メールアドレス" value={user?.email} />
          <SettingsRow label="名前" value="設定・変更" onPress={() => onNavigate('public-profile')} />
          <SettingsRow label="パスワード" value="再設定メールを送る" onPress={() => onNavigate('forgot-password')} />
        </GlassSurface>
        <Text style={styles.section}>読書の設定</Text>
        <Text style={styles.note}>読書設定はサンプルです。変更・保存はできません。</Text>
        <GlassSurface style={styles.group}>
          <SettingsRow label="読書目標" value="月3冊" />
          <View style={styles.reminder}>
            <View>
              <Text style={styles.reminderLabel}>読書リマインダー</Text>
              <Text style={styles.note}>毎日 20:00（準備中）</Text>
            </View>
            <Switch accessibilityLabel="読書リマインダー（準備中）" disabled value={false} trackColor={{ false: '#DDD', true: '#E2B7F0' }} />
          </View>
        </GlassSurface>
        <Text style={styles.section}>サポート</Text>
        <GlassSurface style={styles.group}>
          <SettingsRow label="ヘルプ・よくある質問" />
          <SettingsRow label="お問い合わせ" />
        </GlassSurface>
        {error ? <Text accessibilityRole="alert" style={styles.logout}>{error}</Text> : null}
        <Text accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy}
          onPress={() => { void handleLogout(); }} style={styles.logout}>
          {busy ? '処理中…' : '↪　ログアウト'}
        </Text>
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 110 },
  notice: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 8 },
  section: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 10, marginTop: 16 },
  group: { backgroundColor: 'rgba(255, 255, 255, 0.48)', borderRadius: 16, elevation: 2, overflow: 'hidden', shadowColor: colors.black, shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { height: 1, width: 0 } },
  note: { color: colors.placeholder, fontSize: 12, marginTop: 8 },
  reminder: { alignItems: 'center', borderBottomColor: '#F0EAF2', borderBottomWidth: 1, flexDirection: 'row', height: 62, justifyContent: 'space-between', paddingHorizontal: 16 },
  reminderLabel: { color: colors.placeholder, fontSize: 15 },
  logout: { color: colors.accent, fontSize: 15, fontWeight: '700', marginTop: 28, textAlign: 'center' },
});
