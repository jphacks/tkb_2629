import { useRef, useState } from 'react';
import { currentUser, logout } from '../../lib/auth';
import { colors } from "../../theme/colors";
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../../components/molecules/ActionButton';
import { SettingsRow } from '../../components/molecules/SettingsRow';
import { GlassSurface } from '../../components/atoms/GlassSurface';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import type { Navigate } from '../types';

export function AccountSettingsScreen({ onNavigate }: { onNavigate: Navigate }) {
  const user = currentUser();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const loggingOut = useRef(false);
  const [goal, setGoal] = useState('3');
  const [reminder, setReminder] = useState(false);
  const [time, setTime] = useState('20:00');
  const [support, setSupport] = useState<'help' | 'contact' | null>(null);
  const [message, setMessage] = useState('');
  async function handleLogout() {
    if (loggingOut.current) return;
    loggingOut.current = true;
    setBusy(true); setError('');
    try { await logout(); onNavigate('login'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'ログアウトに失敗しました'); }
    finally { loggingOut.current = false; setBusy(false); }
  }
  return (
    <ScreenFrame activeRoute="account" onNavigate={onNavigate} title="アカウント設定">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.notice}>{"名前は他の読者にも表示されます"}</Text>
        <Text style={styles.section}>アカウント情報</Text>
        <GlassSurface style={styles.group}>
          <SettingsRow label="メールアドレス" value={user?.email} readOnly />
          <SettingsRow label="名前" value="設定・変更" onPress={() => onNavigate('public-profile')} />
          <SettingsRow label="パスワード" value="再設定メールを送る" onPress={() => onNavigate('forgot-password')} />
        </GlassSurface>
        <Text style={styles.section}>読書の設定</Text>
        <GlassSurface style={styles.group}>
          <View style={styles.setting}>
            <Text style={styles.settingLabel}>読書目標</Text>
            <Text>月</Text>
            <TextInput accessibilityLabel="月の読書目標" keyboardType="number-pad" value={goal} onChangeText={setGoal} underlineColorAndroid="transparent" style={styles.input} />
            <Text>冊</Text>
          </View>
          <View style={styles.setting}>
            <Text style={styles.settingLabel}>読書リマインダー</Text>
            <Switch accessibilityLabel="読書リマインダー" value={reminder} onValueChange={setReminder} />
          </View>
          {reminder && <View style={styles.setting}>
            <Text style={styles.settingLabel}>通知時刻</Text>
            <TextInput accessibilityLabel="リマインダーの時刻" value={time} onChangeText={setTime} placeholder="20:00" underlineColorAndroid="transparent" style={styles.input} />
          </View>}
        </GlassSurface>
        <Text style={styles.section}>サポート</Text>
        <GlassSurface style={styles.group}>
          <SettingsRow label="ヘルプ・よくある質問" onPress={() => setSupport(support === 'help' ? null : 'help')} />
          {support === 'help' && <Text style={styles.support}>{"本を探して本棚に追加し、読んだページにしおりと感想を残せます"}</Text>}
          <SettingsRow label="お問い合わせ" onPress={() => setSupport(support === 'contact' ? null : 'contact')} />
          {support === 'contact' && <TextInput accessibilityLabel="お問い合わせ内容" multiline placeholder="お問い合わせ内容を入力" value={message} onChangeText={setMessage} style={styles.message} />}
        </GlassSurface>
        <Text style={styles.section}>ログアウト</Text>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <ActionButton label={busy ? 'ログアウト中…' : 'ログアウト'} disabled={busy} secondary onPress={() => { void handleLogout(); }} />
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  setting: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 58, paddingHorizontal: 16, paddingVertical: 8 },
  settingLabel: { color: colors.text, fontSize: 15, flex: 1 },
  input: { color: colors.textSecondary, backgroundColor: 'transparent', borderWidth: 0, fontSize: 15, textAlign: 'right', minHeight: 44, minWidth: 44, paddingHorizontal: 0 },
  support: { color: colors.textSecondary, padding: 16, lineHeight: 22 },
  message: { color: colors.text, backgroundColor: colors.background, minHeight: 100, margin: 16, padding: 12, borderRadius: 8, textAlignVertical: 'top' },
  content: { padding: 24, paddingBottom: 110 },
  notice: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 8 },
  section: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 10, marginTop: 16 },
  group: { backgroundColor: 'rgba(255, 255, 255, 0.48)', borderRadius: 16, elevation: 2, overflow: 'hidden', shadowColor: colors.black, shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { height: 1, width: 0 } },
  error: { color: colors.accent, fontSize: 14, lineHeight: 20, marginBottom: 12 },
});
