import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../components/molecules/ActionButton';
import { ReadingBookCard } from '../../components/molecules/ReadingBookCard';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import type { Book } from '../../lib/api';
import { loadReadingBooks } from '../../lib/readingBooks';
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
    loadReadingBooks(() => active)
      .then((books) => {
        if (active && books) setState({ status: 'success', books });
      })
      .catch((reason: unknown) => {
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
    <ScreenFrame
      activeRoute="reading"
      headerAction={(
        <Pressable
          accessibilityLabel="本を追加"
          accessibilityRole="button"
          onPress={() => onNavigate('search')}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
        >
          <Ionicons color={colors.navAccent} name="add" size={24} />
        </Pressable>
      )}
      onNavigate={onNavigate}
      subtitle="読書の続きを記録しましょう"
      title="今読んでいる本"
    >
      <ScrollView contentContainerStyle={styles.content}>
        {state.status === 'loading' && <Text style={styles.message}>読書中の本を読み込んでいます…</Text>}
        {state.status === 'error' && (
          <View style={styles.notice}>
            <Text accessibilityRole="alert" style={styles.message}>{state.message}</Text>
            <ActionButton label="再試行" onPress={() => setRequestVersion((version) => version + 1)} />
          </View>
        )}
        {state.status === 'success' && state.books.length === 0 && (
          <View style={styles.notice}>
            <Text style={styles.message}>読書中の本はありません。本を追加すると、しおりを挟めます。</Text>
            <ActionButton label="本を追加する" onPress={() => onNavigate('search')} />
          </View>
        )}
        {state.status === 'success' && (
          <View style={styles.bookList}>
            {state.books.map((book) => (
              <ReadingBookCard
                book={book}
                key={book.id}
                onBookmark={() => onNavigate({ name: 'bookmark', bookId: book.id, iteration: book.latest_iteration })}
                onPress={() => onNavigate({ name: 'book-detail', bookId: book.id })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  addButton: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.72)', borderColor: 'rgba(255, 255, 255, 0.9)', borderRadius: 20, borderWidth: 1, height: 40, justifyContent: 'center', marginTop: 2, width: 40 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.94 }] },
  content: { padding: 24, paddingBottom: 110 },
  message: { color: colors.placeholder, fontSize: 14, marginTop: 16 },
  notice: { gap: 16 },
  bookList: { gap: 12, marginTop: 8 },
});
