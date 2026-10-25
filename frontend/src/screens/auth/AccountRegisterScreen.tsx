import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../components/molecules/ActionButton';
import { BrandHeader } from '../../components/molecules/BrandHeader';
import { ShadowInput } from '../../components/atoms/ShadowInput';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import type { Navigate } from '../types';

export function AccountRegisterScreen({ onNavigate }: { onNavigate: Navigate }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <ScreenFrame activeRoute="account" onNavigate={onNavigate}>
      <ScrollView contentContainerStyle={styles.content}>
        <BrandHeader />
        <Text style={styles.title}>アカウント登録</Text>
        <Text style={styles.description}>読書の記録をはじめましょう</Text>
        <View style={styles.form}>
          <Text style={styles.label}>ユーザー名</Text><ShadowInput onChangeText={setName} placeholder="ユーザー名を入力" value={name} style={styles.input} />
          <Text style={styles.label}>メールアドレス</Text><ShadowInput autoCapitalize="none" keyboardType="email-address" onChangeText={setEmail} placeholder="メールアドレスを入力" value={email} style={styles.input} />
          <Text style={styles.label}>パスワード</Text><ShadowInput onChangeText={setPassword} placeholder="パスワードを入力" secureTextEntry value={password} style={styles.input} />
          <Text style={styles.note}>8文字以上のパスワードを設定してください</Text>
        </View>
        <Text style={styles.note}>登録することで利用規約に同意したものとみなされます</Text>
        <ActionButton label="アカウントを登録" onPress={() => onNavigate('register-complete')} />
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 110 },
  title: { color: '#464646', fontSize: 26, fontWeight: '700', marginTop: 12 },
  description: { color: '#9CA3AF', fontSize: 14, marginTop: 8 },
  form: { gap: 8, marginTop: 24 },
  label: { color: '#464646', fontSize: 14, fontWeight: '600', marginTop: 8 },
  input: { height: 54, width: '100%' },
  note: { color: '#9CA3AF', fontSize: 12, lineHeight: 18, marginTop: 10 },
});
