import { colors } from "../../theme/colors";
import { ScrollView, StyleSheet, Text } from 'react-native';

import { ActionButton } from '../../components/molecules/ActionButton';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import type { Navigate } from '../types';

export function BookEditScreen({ bookId, onNavigate }: { bookId: number; onNavigate: Navigate }) {
  return (
    <ScreenFrame activeRoute="bookshelf" onNavigate={onNavigate} title="本の編集">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>本の編集は準備中です</Text>
        <Text style={styles.body}>{"書名・著者名などの変更と保存には、まだ対応していません"}</Text>
        <ActionButton label="本の詳細へ戻る" onPress={() => onNavigate({ name: 'book-detail', bookId })} secondary />
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, padding: 24, paddingBottom: 110 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 8 },
  body: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 12 },
});
