import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../../components/molecules/ActionButton';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import type { ScreenKey } from '../types';

export function EmailVerificationScreen({ onNavigate }: { onNavigate: (route: ScreenKey) => void }) {
  const [code, setCode] = useState('');
  return (
    <ScreenFrame activeRoute="account" onNavigate={onNavigate}>
      <View style={styles.content}>
        <Text style={styles.topText}>アカウント登録</Text>
        <Text style={styles.icon}>✉</Text>
        <Text style={styles.title}>メールアドレスを認証</Text>
        <View style={styles.message}><Text style={styles.body}>入力したメールアドレスに認証コードを送信しました。</Text><Text style={styles.email}>example@email.com</Text></View>
        <Text style={styles.label}>認証コードを入力</Text>
        <TextInput autoFocus keyboardType="number-pad" maxLength={6} onChangeText={setCode} placeholder="6桁のコード" style={styles.input} value={code} />
        <ActionButton label="認証する" onPress={() => onNavigate('register-complete')} />
        <Text style={styles.help}>コードが届きませんか？</Text><Text style={styles.link}>認証コードを再送信</Text>
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24 },
  topText: { color: '#9CA3AF', fontSize: 14 },
  icon: { color: '#C17AED', fontSize: 58, marginTop: 12, textAlign: 'center' },
  title: { color: '#464646', fontSize: 25, fontWeight: '700', marginTop: 20, textAlign: 'center' },
  message: { backgroundColor: '#FFF4F4', borderRadius: 14, marginTop: 24, padding: 20 },
  body: { color: '#464646', fontSize: 14, lineHeight: 22, textAlign: 'center' },
  email: { color: '#C17AED', fontSize: 16, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  label: { color: '#464646', fontSize: 14, fontWeight: '600', marginTop: 24 },
  input: { borderColor: '#E5DCE8', borderRadius: 12, borderWidth: 1, color: '#464646', fontSize: 24, height: 60, letterSpacing: 12, marginTop: 8, textAlign: 'center' },
  help: { color: '#9CA3AF', fontSize: 13, marginTop: 24, textAlign: 'center' },
  link: { color: '#C17AED', fontSize: 13, marginTop: 8, textAlign: 'center' },
});
