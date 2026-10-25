import { currentUser } from '../../lib/auth';
import { useEffect, useState } from 'react';
import { getPublicProfile } from '../../lib/api';
import { ActionButton } from '../../components/molecules/ActionButton';
import { colors } from "../../theme/colors";
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SettingsRow } from '../../components/molecules/SettingsRow';
import { GlassSurface } from '../../components/atoms/GlassSurface';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import type { Navigate } from '../types';

export function AccountScreen({ onNavigate }: { onNavigate: Navigate }) {
  const user = currentUser();
  const [profile, setProfile] = useState<
    { status: 'loading' } | { status: 'ready'; name: string | null } | { status: 'error'; message: string }
  >({ status: 'loading' });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setProfile({ status: 'loading' });
    getPublicProfile().then((result) => {
      if (active) setProfile({ status: 'ready', name: result.public_display_name });
    }).catch((reason: unknown) => {
      if (active) setProfile({ status: 'error', message: reason instanceof Error ? reason.message : '名前の取得に失敗しました。' });
    });
    return () => { active = false; };
  }, [version]);
  const name = profile.status === 'ready' ? profile.name : null;
  return (
    <ScreenFrame activeRoute="account" onNavigate={onNavigate} title="アカウント">
      <ScrollView contentContainerStyle={styles.content}>
        <GlassSurface style={styles.profile}>
          <View style={styles.avatar}><Text style={styles.initial}>{name ? Array.from(name)[0] : '…'}</Text></View>
          <View style={styles.profileCopy}>
            <Text style={styles.name}>{profile.status === 'loading' ? '名前を読み込み中…' : profile.status === 'error' ? '名前を取得できません' : name ?? '名前は未設定'}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <Text style={styles.member}>しおりを利用中</Text>
          </View>
        </GlassSurface>
        {profile.status === 'error' && <>
          <Text accessibilityRole="alert" style={styles.error}>{profile.message}</Text>
          <ActionButton label="名前を再読み込み" secondary onPress={() => setVersion((value) => value + 1)} />
        </>}
        <Text style={styles.section}>読書の概要</Text><GlassSurface style={styles.stats}><Stat value="12" label="読んだ本" /><Stat value="3" label="読書中" /><Stat value="86" label="読んだページ" /></GlassSurface>
        <Text style={styles.section}>アカウントメニュー</Text><GlassSurface style={styles.menu}><SettingsRow icon="♙" label="名前を設定・変更" onPress={() => onNavigate('public-profile')} /><SettingsRow icon="⚙" label="アカウント設定" onPress={() => onNavigate('account-settings')} /></GlassSurface>
      </ScrollView>
    </ScreenFrame>
  );
}

function Stat({ value, label }: { value: string; label: string }) { return <View style={styles.stat}><Text style={styles.value}>{value}</Text><Text style={styles.label}>{label}</Text></View>; }

const styles = StyleSheet.create({
  profileCopy: { flex: 1, minWidth: 0 },
  error: { color: '#B42318', fontSize: 14, lineHeight: 22, marginVertical: 12 },
  content: { padding: 24, paddingBottom: 110 }, profile: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.48)', borderRadius: 20, flexDirection: 'row', gap: 18, marginTop: 8, padding: 20 }, avatar: { alignItems: 'center', backgroundColor: '#E2B7F0', borderRadius: 32, height: 64, justifyContent: 'center', width: 64 }, initial: { color: colors.background, fontSize: 28, fontWeight: '700' }, name: { color: colors.text, fontSize: 20, fontWeight: '700' }, email: { color: colors.placeholder, fontSize: 13, marginTop: 5 }, member: { color: colors.navAccent, fontSize: 12, marginTop: 5 }, section: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 12, marginTop: 28 }, stats: { backgroundColor: 'rgba(255, 255, 255, 0.48)', borderRadius: 16, elevation: 2, flexDirection: 'row', paddingVertical: 18, shadowColor: colors.black, shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { height: 1, width: 0 } }, stat: { alignItems: 'center', flex: 1 }, value: { color: colors.text, fontSize: 27, fontWeight: '700' }, label: { color: colors.placeholder, fontSize: 12, marginTop: 6 }, menu: { backgroundColor: 'rgba(255, 255, 255, 0.48)', borderRadius: 16, elevation: 2, overflow: 'hidden', shadowColor: colors.black, shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { height: 1, width: 0 } },
});
