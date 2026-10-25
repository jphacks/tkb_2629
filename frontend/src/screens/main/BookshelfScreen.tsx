import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../components/molecules/ActionButton';
import { BookRow } from '../../components/molecules/BookRow';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import { getBooks, type Book } from '../../lib/api';
import type { ScreenKey } from '../types';

type BookshelfScreenProps = {
  onNavigate: (route: ScreenKey) => void;
  onOpenBook: (book: Book) => void;
};

export function BookshelfScreen({ onNavigate, onOpenBook }: BookshelfScreenProps) {
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
        {books.map((book) => (
          <BookRow
            author={book.author}
            key={book.id}
            title={book.title}
            status={book.reading_status === 'completed' ? `${book.latest_iteration}回目 読了` : `${book.latest_iteration}回目 読書中`}
            onPress={() => onOpenBook(book)}
          />
        ))}
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
  message: { color: '#777777', fontSize: 14, marginBottom: 18 },
});
