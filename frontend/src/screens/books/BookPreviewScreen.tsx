import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../components/molecules/ActionButton';
import { BackButton } from '../../components/molecules/BackButton';
import { BookCover } from '../../components/molecules/BookCover';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import type { Book, GoogleBook } from '../../lib/api';
import { shelfStatusLabel } from '../../lib/readingStatus';
import { colors } from '../../theme/colors';
import type { Navigate, ScreenKey } from '../types';

type BookPreviewScreenProps = {
  book: GoogleBook;
  owned?: Book;
  adding: boolean;
  message: string | null;
  activeRoute: ScreenKey;
  onNavigate: Navigate;
  onBack: () => void;
  onAdd: () => void;
};

export function BookPreviewScreen({
  book, owned, adding, message, activeRoute, onNavigate, onBack, onAdd,
}: BookPreviewScreenProps) {
  return (
    <ScreenFrame activeRoute={activeRoute} onNavigate={onNavigate} title="本の詳細"
      headerLeading={<BackButton onPress={onBack} />}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.cover}>
          <BookCover large title={book.title} author={book.author ?? '著者不明'} />
        </View>
        <Text style={styles.title}>{book.title}</Text>
        <Text style={styles.body}>{book.author ?? '著者不明'}</Text>
        <Text style={styles.body}>{book.total_pages}ページ</Text>
        {owned && <Text style={styles.body}>{shelfStatusLabel(owned)}</Text>}
        <Text style={styles.body}>
          他の人が感想を書いたページの表示は準備中です。
        </Text>
        {message && <Text accessibilityRole="alert" style={styles.body}>{message}</Text>}
        {owned ? (
          <ActionButton label="追加済みの本を開く" onPress={() => onNavigate({ name: 'book-detail', bookId: owned.id })} />
        ) : (
          <ActionButton label={adding ? '追加中…' : '本棚に追加する'} onPress={adding ? undefined : onAdd} />
        )}
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, padding: 24, paddingBottom: 110 },
  cover: { alignItems: 'center' },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  body: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
});