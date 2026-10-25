import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../components/molecules/ActionButton';
import { BookCover } from '../../components/molecules/BookCover';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import { getBooks, type Book } from '../../lib/api';
import { colors } from '../../theme/colors';
import type { Navigate } from '../types';

export function BookshelfScreen({ onNavigate }: { onNavigate: Navigate }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getBooks()
      .then((items) => {
        if (active) {
          setBooks(items);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : '本棚の取得に失敗しました。');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <ScreenFrame activeRoute="bookshelf" onNavigate={onNavigate} title="本棚" subtitle="あなたの本を整理しましょう">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.filters}><Text style={styles.activeFilter}>すべて</Text><Text style={styles.filter}>読書中</Text><Text style={styles.filter}>読了</Text></View>
        {loading && <Text style={styles.message}>本棚を読み込んでいます…</Text>}
        {error && <Text style={styles.message}>{error}</Text>}
        {!loading && !error && books.length === 0 && (
          <Text style={styles.message}>本棚にはまだ本がありません。</Text>
        )}
        <View style={styles.grid}>
          {books.map((book) => (
            <Pressable key={book.id} onPress={() => onNavigate({ name: 'book-detail', bookId: book.id })} style={styles.book}>
              <BookCover grid title={book.title} author={book.author ?? '著者不明'} />
              <Text numberOfLines={1} style={styles.bookTitle}>{book.title}</Text>
            </Pressable>
          ))}
        </View>
        <ActionButton label="本を追加する" onPress={() => onNavigate('add-book')} />
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 110 },
  filters: { flexDirection: 'row', gap: 10, marginBottom: 18, marginTop: 8 },
  activeFilter: { backgroundColor: '#FF7171', borderRadius: 16, color: '#FFFFFF', fontSize: 13, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 16, paddingVertical: 8 },
  filter: { backgroundColor: '#FFF0F0', borderRadius: 16, color: '#777777', fontSize: 13, overflow: 'hidden', paddingHorizontal: 16, paddingVertical: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 26, marginBottom: 30 },
  book: { alignItems: 'center', width: '31%' },
  bookTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 10, textAlign: 'center', width: '100%' },
  message: { color: '#777777', fontSize: 14, marginBottom: 18 },
});
