import { colors } from "../../theme/colors";
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../components/molecules/ActionButton';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import type { Navigate } from '../types';

export function AccountRegisterCompleteScreen({ onNavigate }: { onNavigate: Navigate }) {
  return (
    <ScreenFrame activeRoute="account" onNavigate={onNavigate}>
      <View style={styles.content}>
        <View style={styles.check}><Text style={styles.checkText}>✓</Text></View>
        <Text style={styles.title}>アカウント登録完了</Text>
        <Text style={styles.description}>アカウントの登録が完了しました。</Text>
        <Text style={styles.body}>しおりを使って、読書の記録をはじめましょう。あなたの読書体験を大切に保存できます。</Text>
        <View style={styles.start}><Text style={styles.body}>まずは本を追加してみましょう。</Text><Text style={styles.body}>いつでも読書を再開できます。</Text></View>
        <ActionButton label="はじめる" onPress={() => onNavigate('home')} />
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', padding: 24, paddingTop: 32 },
  check: { alignItems: 'center', backgroundColor: '#E9C7F5', borderRadius: 82, height: 164, justifyContent: 'center', width: 164 },
  checkText: { color: colors.background, fontSize: 72, fontWeight: '700' },
  title: { color: colors.text, fontSize: 25, fontWeight: '700', marginTop: 44, textAlign: 'center' },
  description: { color: colors.text, fontSize: 15, marginTop: 18, textAlign: 'center' },
  body: { color: colors.placeholder, fontSize: 14, lineHeight: 22, textAlign: 'center' },
  start: { marginVertical: 38 },
});
