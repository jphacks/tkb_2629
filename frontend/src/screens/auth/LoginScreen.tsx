import { colors } from "../../theme/colors";
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../components/molecules/ActionButton';
import { BrandHeader } from '../../components/molecules/BrandHeader';
import { ShadowInput } from '../../components/atoms/ShadowInput';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import type { ScreenKey } from '../types';

export function LoginScreen({ onNavigate }: { onNavigate: (route: ScreenKey) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <ScreenFrame activeRoute="account" onNavigate={onNavigate}>
      <View style={styles.content}>
        <BrandHeader />
        <Text style={styles.title}>おかえりなさい</Text>
        <Text style={styles.description}>アカウントにログインしてください</Text>
        <View style={styles.form}>
          <Text style={styles.label}>メールアドレス</Text><ShadowInput autoCapitalize="none" keyboardType="email-address" onChangeText={setEmail} placeholder="メールアドレス" value={email} style={styles.input} />
          <Text style={styles.label}>パスワード</Text><ShadowInput onChangeText={setPassword} placeholder="パスワード" secureTextEntry value={password} style={styles.input} />
          <Text style={styles.link}>パスワードを忘れた方はこちら</Text>
          <ActionButton label="ログイン" onPress={() => onNavigate('home')} />
        </View>
        <Text style={styles.prompt}>アカウントをお持ちでない方</Text>
        <ActionButton label="新規登録" onPress={() => onNavigate('register')} secondary />
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24 },
  title: { color: colors.text, fontSize: 26, fontWeight: '700', marginTop: 12 },
  description: { color: colors.placeholder, fontSize: 14, marginTop: 8 },
  form: { gap: 8, marginTop: 24 },
  label: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 8 },
  input: { height: 54, width: '100%' },
  link: { color: colors.navAccent, fontSize: 13, marginVertical: 8, textAlign: 'right' },
  prompt: { color: colors.placeholder, fontSize: 14, marginBottom: 14, marginTop: 24, textAlign: 'center' },
});
