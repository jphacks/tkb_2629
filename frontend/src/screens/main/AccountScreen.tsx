import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SettingsRow } from '../../components/molecules/SettingsRow';
import { GlassSurface } from '../../components/atoms/GlassSurface';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import type { Navigate } from '../types';

export function AccountScreen({ onNavigate }: { onNavigate: Navigate }) {
  return (
    <ScreenFrame activeRoute="account" onNavigate={onNavigate} title="アカウント">
      <ScrollView contentContainerStyle={styles.content}>
        <GlassSurface style={styles.profile}><View style={styles.avatar}><Text style={styles.initial}>A</Text></View><View><Text style={styles.name}>読書ユーザー</Text><Text style={styles.email}>user@example.com</Text><Text style={styles.member}>しおりを利用中</Text></View></GlassSurface>
        <Text style={styles.section}>読書の概要</Text><GlassSurface style={styles.stats}><Stat value="12" label="読んだ本" /><Stat value="3" label="読書中" /><Stat value="86" label="読んだページ" /></GlassSurface>
        <Text style={styles.section}>アカウントメニュー</Text><GlassSurface style={styles.menu}><SettingsRow icon="♙" label="プロフィールを編集" /><SettingsRow icon="⚙" label="アカウント設定" onPress={() => onNavigate('account-settings')} /></GlassSurface>
      </ScrollView>
    </ScreenFrame>
  );
}

function Stat({ value, label }: { value: string; label: string }) { return <View style={styles.stat}><Text style={styles.value}>{value}</Text><Text style={styles.label}>{label}</Text></View>; }

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 110 }, profile: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.48)', borderRadius: 20, flexDirection: 'row', gap: 18, marginTop: 8, padding: 20 }, avatar: { alignItems: 'center', backgroundColor: '#E2B7F0', borderRadius: 32, height: 64, justifyContent: 'center', width: 64 }, initial: { color: '#FFFFFF', fontSize: 28, fontWeight: '700' }, name: { color: '#464646', fontSize: 20, fontWeight: '700' }, email: { color: '#9CA3AF', fontSize: 13, marginTop: 5 }, member: { color: '#C17AED', fontSize: 12, marginTop: 5 }, section: { color: '#464646', fontSize: 18, fontWeight: '700', marginBottom: 12, marginTop: 28 }, stats: { backgroundColor: 'rgba(255, 255, 255, 0.48)', borderRadius: 16, elevation: 2, flexDirection: 'row', paddingVertical: 18, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { height: 1, width: 0 } }, stat: { alignItems: 'center', flex: 1 }, value: { color: '#464646', fontSize: 27, fontWeight: '700' }, label: { color: '#9CA3AF', fontSize: 12, marginTop: 6 }, menu: { backgroundColor: 'rgba(255, 255, 255, 0.48)', borderRadius: 16, elevation: 2, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { height: 1, width: 0 } },
});
