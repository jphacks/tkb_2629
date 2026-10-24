import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { SettingsRow } from '../../components/molecules/SettingsRow';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import type { ScreenKey } from '../types';

export function AccountSettingsScreen({ onNavigate }: { onNavigate: (route: ScreenKey) => void }) {
  return <ScreenFrame activeRoute="account" onNavigate={onNavigate} title="アカウント設定"><ScrollView contentContainerStyle={styles.content}><Text style={styles.section}>アカウント情報</Text><View style={styles.group}><SettingsRow label="メールアドレス" value="user@example.com" /><SettingsRow label="ユーザー名" value="読書ユーザー" /><SettingsRow label="パスワード" value="変更する" /></View><Text style={styles.note}>アカウント情報を変更できます</Text><Text style={styles.section}>読書の設定</Text><View style={styles.group}><SettingsRow label="読書目標" value="月3冊" /><View style={styles.reminder}><View><Text style={styles.reminderLabel}>読書リマインダー</Text><Text style={styles.note}>毎日 20:00</Text></View><Switch value trackColor={{ false: '#DDD', true: '#E2B7F0' }} thumbColor="#C17AED" /></View></View><Text style={styles.section}>サポート</Text><View style={styles.group}><SettingsRow label="ヘルプ・よくある質問" /><SettingsRow label="お問い合わせ" /></View><Text style={styles.logout}>↪　ログアウト</Text></ScrollView></ScreenFrame>;
}

const styles = StyleSheet.create({ content: { padding: 24, paddingBottom: 110 }, section: { color: '#464646', fontSize: 16, fontWeight: '700', marginBottom: 10, marginTop: 16 }, group: { backgroundColor: '#FFFFFF', borderRadius: 16, elevation: 2, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { height: 1, width: 0 } }, note: { color: '#9CA3AF', fontSize: 12, marginTop: 8 }, reminder: { alignItems: 'center', borderBottomColor: '#F0EAF2', borderBottomWidth: 1, flexDirection: 'row', height: 62, justifyContent: 'space-between', paddingHorizontal: 16 }, reminderLabel: { color: '#464646', fontSize: 15 }, logout: { color: '#FF7171', fontSize: 15, fontWeight: '700', marginTop: 28, textAlign: 'center' } });
