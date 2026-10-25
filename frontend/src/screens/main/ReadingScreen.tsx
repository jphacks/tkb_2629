import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../components/molecules/ActionButton';
import { BookCover } from '../../components/molecules/BookCover';
import { ReadingProgress } from '../../components/molecules/ReadingProgress';
import { GlassSurface } from '../../components/atoms/GlassSurface';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import { getBooks, type Book } from '../../lib/api';
import { colors } from '../../theme/colors';
import type { Navigate } from '../types';

type ReadingState =
  | { status: 'loading' }
  | { status: 'success'; books: Book[] }
  | { status: 'error'; message: string };

export function ReadingScreen({ onNavigate }: { onNavigate: Navigate }) {
  const [state, setState] = useState<ReadingState>({ status: 'loading' });
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    async function loadBooks() {
      const books: Book[] = [];
      let offset = 0;
      while (active) {
        const page = await getBooks(offset);
        if (!active) {
          return;
        }
        books.push(...page.filter((book) => book.reading_status === 'reading'));
        if (page.length < 100) {
          setState({ status: 'success', books });
          return;
        }
        offset += page.length;
      }
    }
    loadBooks().catch((reason: unknown) => {
      if (active) {
        setState({
          status: 'error',
          message: reason instanceof Error ? reason.message : '読書中の本の取得に失敗しました。',
        });
      }
    });
    return () => {
      active = false;
    };
  }, [requestVersion]);

  return (
    <ScreenFrame activeRoute="reading" onNavigate={onNavigate} title="今読んでる本" subtitle="読書の続きを記録しましょう">
      <ScrollView contentContainerStyle={styles.content}>
        {state.status === 'loading' && <Text style={styles.message}>読書中の本を読み込んでいます…</Text>}
        {state.status === 'error' && (
          <View style={styles.error}>
            <Text accessibilityRole="alert" style={styles.message}>{state.message}</Text>
            <ActionButton label="再試行" onPress={() => {
              setState({ status: 'loading' });
              setRequestVersion((version) => version + 1);
            }} />
          </View>
        )}
        {state.status === 'success' && state.books.length === 0 && (
          <View style={styles.error}>
            <Text style={styles.message}>読書中の本はありません。本棚から本を追加してください。</Text>
            <ActionButton label="本棚へ" onPress={() => onNavigate('bookshelf')} />
          </View>
        )}
        <View style={styles.bookGrid}>
          {state.status === 'success' && state.books.map((book) => (
            <GlassSurface
              accessibilityLabel={`${book.title}の読書カード`}
              key={book.id}
              onPress={() => onNavigate({ name: 'book-detail', bookId: book.id })}
              style={styles.book}
            >
              <BookCover title={book.title} author={book.author ?? '著者不明'} />
              <View style={styles.copy}>
                <Text numberOfLines={1} style={styles.title}>{book.title}</Text>
                <Text numberOfLines={1} style={styles.author}>{book.author ?? '著者不明'}</Text>
                <ReadingProgress currentPage={book.current_page} totalPages={book.total_pages} />
              </View>
            </GlassSurface>
          ))}
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 110 },
  message: { color: colors.placeholder, fontSize: 14, marginTop: 16 },
  error: { gap: 16 },
  bookGrid: { gap: 12, marginTop: 8 },
  book: { alignItems: 'center', borderRadius: 18, flexDirection: 'row', gap: 16, padding: 14, width: '100%' },
  copy: { flex: 1 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  author: { color: colors.placeholder, fontSize: 11, marginTop: 6 },
});
