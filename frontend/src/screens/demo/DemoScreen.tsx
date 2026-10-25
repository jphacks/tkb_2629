import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

export function DemoScreen({ children }: { children: ReactNode }) {
  return (
    <View style={styles.screen}>
      <View style={styles.notice}>
        <Text style={styles.title}>体験デモ · ログイン不要</Text>
        <Text style={styles.copy}>本物の画面で操作できます · データは架空です{'\n'}感想は外部送信せず、色は仮の固定色です（AI解析なし）{'\n'}ホームの本から栞を追加 → 詳細で自分とみんなを比較{'\n'}変更はこの画面内のみ · 再読み込みでリセット</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.backgroundSoft },
  notice: { paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.navAccent },
  title: { color: colors.text, fontSize: 13, fontWeight: '700' },
  copy: { color: colors.text, fontSize: 11, lineHeight: 16, marginTop: 3 },
});
