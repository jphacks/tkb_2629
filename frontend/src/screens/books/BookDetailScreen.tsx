import { colors } from "../../theme/colors";
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../components/molecules/ActionButton';
import { BookCover } from '../../components/molecules/BookCover';
import { FloatingActionButton } from '../../components/molecules/FloatingActionButton';
import { ReadingProgress } from '../../components/molecules/ReadingProgress';
import { GlassSurface } from '../../components/atoms/GlassSurface';
import { EmotionAnalysisCard, getAggregateEmotionColor, getEmotionTint } from '../../components/organisms/EmotionAnalysisCard';
import { allBookmarks, BookmarkListCard } from '../../components/organisms/BookmarkListCard';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import { getBook, getBookReviews, type Book, type PageReview } from '../../lib/api';
import type { Navigate } from '../types';

type BookDetailScreenProps = {
  bookId: number;
  onNavigate: Navigate;
};

type BookDetailState =
  | { bookId: number; status: 'loading' }
  | { bookId: number; status: 'success'; book: Book }
  | { bookId: number; status: 'error'; message: string };

export function BookDetailScreen({ bookId, onNavigate }: BookDetailScreenProps) {
  const [state, setState] = useState<BookDetailState>({ bookId, status: 'loading' });
  const [requestVersion, setRequestVersion] = useState(0);
  const [reviews, setReviews] = useState<PageReview[] | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewVersion, setReviewVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ bookId, status: 'loading' });
    getBook(bookId)
      .then((book) => {
        if (active) {
          setState({ bookId, status: 'success', book });
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setState({
            bookId,
            status: 'error',
            message: reason instanceof Error ? reason.message : '本の詳細の取得に失敗しました。',
          });
        }
      });
    return () => {
      active = false;
    };
  }, [bookId, requestVersion]);

  const book = state.bookId === bookId && state.status === 'success' ? state.book : null;
  useEffect(() => {
    let active = true;
    setReviews(null);
    setReviewError(null);
    if (!book) return;
    getBookReviews(bookId, book.latest_iteration).then((items) => {
      if (active) setReviews(items);
    }).catch((reason: unknown) => {
      if (active) setReviewError(reason instanceof Error ? reason.message : 'しおり一覧の取得に失敗しました。');
    });
    return () => { active = false; };
  }, [book, bookId, reviewVersion]);
  const emotionColor = getAggregateEmotionColor(allBookmarks);
  const emotionTint = getEmotionTint(emotionColor);
  const isReading = book?.reading_status === 'reading';

  return (
    <ScreenFrame activeRoute="bookshelf" onNavigate={onNavigate} title="本の詳細">
      <ScrollView contentContainerStyle={styles.content}>
        {(state.bookId !== bookId || state.status === 'loading') && (
          <Text style={styles.message}>本の詳細を読み込んでいます…</Text>
        )}
        {state.bookId === bookId && state.status === 'error' && (
          <View style={styles.error}>
            <Text accessibilityRole="alert" style={styles.message}>{state.message}</Text>
            <ActionButton label="再試行" onPress={() => {
              setState({ bookId, status: 'loading' });
              setRequestVersion((version) => version + 1);
            }} />
          </View>
        )}
        {book && (
          <>
            <GlassSurface style={styles.hero}>
              <Pressable accessibilityLabel="本の情報を編集" accessibilityRole="button" onPress={() => onNavigate({ name: 'book-edit', bookId })} style={styles.editButton}>
                <Ionicons color={emotionColor} name="pencil" size={22} />
              </Pressable>
              <BookCover large title={book.title} author={book.author ?? '著者不明'} />
              <View style={styles.info}>
                <Text style={styles.title}>{book.title}</Text>
                <Text style={styles.author}>{book.author ?? '著者不明'}</Text>
                <Text style={styles.status}>{isReading ? '読書中' : '読了'}</Text>
              </View>
            </GlassSurface>
            {isReading && (
              <GlassSurface style={styles.card}>
                <ReadingProgress color={emotionColor} currentPage={book.current_page} totalPages={book.total_pages} />
              </GlassSurface>
            )}
            {!reviews && !reviewError && <Text style={styles.message}>しおりを読み込んでいます…</Text>}
            {reviewError && (
              <View style={styles.error}>
                <Text accessibilityRole="alert" style={styles.message}>{reviewError}</Text>
                <ActionButton label="しおり一覧を再試行" onPress={() => setReviewVersion((version) => version + 1)} />
              </View>
            )}
            {reviews && <BookmarkListCard key={`${bookId}:${book.latest_iteration}`} reviews={reviews} totalPages={book.total_pages} accentColor={emotionColor} tintColor={emotionTint} />}
            <Text style={styles.message}>以下の感情分析・画面のアクセント色はサンプルです。自分のしおりには保存された色を表示します。</Text>
            <EmotionAnalysisCard bookmarks={allBookmarks} />
          </>
        )}
      </ScrollView>
      {book && isReading && (
        <FloatingActionButton onPress={() => onNavigate({
          name: 'bookmark',
          bookId,
          iteration: book.latest_iteration,
        })} />
      )}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 110 },
  hero: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.48)', borderRadius: 20, flexDirection: 'row', marginTop: 8, padding: 18, position: 'relative' },
  info: { flex: 1, marginLeft: 18, justifyContent: 'center' },
  editButton: { alignItems: 'center', backgroundColor: colors.background, borderRadius: 18, elevation: 2, height: 36, justifyContent: 'center', position: 'absolute', right: 14, top: 14, width: 36 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700'},
  author: { color: colors.textSecondary, fontSize: 14, marginTop: 8 },
  status: { color: colors.textSecondary, fontSize: 12, marginTop: 6 },
  message: { color: colors.placeholder, fontSize: 14, marginTop: 16 },
  error: { gap: 16 },
  card: { backgroundColor: 'rgba(255, 255, 255, 0.48)', borderRadius: 16, elevation: 2, marginTop: 16, padding: 18, shadowColor: colors.black, shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { height: 1, width: 0 } },
});
