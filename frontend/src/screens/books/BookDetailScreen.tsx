import { colors } from "../../theme/colors";
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../components/molecules/ActionButton';
import { BookCover } from '../../components/molecules/BookCover';
import { FloatingActionButton } from '../../components/molecules/FloatingActionButton';
import { ReadingProgress } from '../../components/molecules/ReadingProgress';
import { GlassSurface } from '../../components/atoms/GlassSurface';
import { EmotionAnalysisCard, getEmotionTint } from '../../components/organisms/EmotionAnalysisCard';
import { BookmarkListCard } from '../../components/organisms/BookmarkListCard';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import { ApiError, completeIteration, getBook, getBookEmotions, getBookReviews, type Book, type BookEmotions, type PageReview } from '../../lib/api';
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
  const [emotions, setEmotions] = useState<BookEmotions | null>(null);
  const [emotionError, setEmotionError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  useEffect(() => {
    setCompleting(false);
    setCompleteError(null);
  }, [bookId]);
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
  useEffect(() => {
    let active = true;
    setEmotions(null);
    setEmotionError(null);
    if (!book) return;
    getBookEmotions(bookId).then((summary) => {
      if (active) setEmotions(summary);
    }).catch((reason: unknown) => {
      if (active) setEmotionError(reason instanceof Error ? reason.message : '感情分析の取得に失敗しました。');
    });
    return () => { active = false; };
  }, [book, bookId, reviewVersion]);
  const emotionColor = emotions?.color_code ?? '#8C8C8C';
  const emotionTint = getEmotionTint(emotionColor);
  const isReading = book?.reading_status === 'reading';

  async function complete(target: Book) {
    setCompleting(true);
    setCompleteError(null);
    try {
      await completeIteration(bookId, target.latest_iteration);
    } catch (reason: unknown) {
      // 409: already completed elsewhere, so just reload the latest state.
      if (!(reason instanceof ApiError && reason.status === 409)) {
        setCompleting(false);
        setCompleteError(reason instanceof Error ? reason.message : '読了の記録に失敗しました。');
        return;
      }
    }
    setCompleting(false);
    setRequestVersion((version) => version + 1);
  }

  function confirmComplete(target: Book) {
    if (completing) return;
    Alert.alert(
      '読了にしますか？',
      `「${target.title}」を読了にします。この読書回のしおりは追加・編集できなくなります。`,
      [
        { style: 'cancel', text: 'キャンセル' },
        { onPress: () => { void complete(target); }, text: '読了にする' },
      ],
    );
  }

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
                <View style={styles.completeAction}>
                  <ActionButton
                    label={completing ? '読了にしています…' : '読了にする'}
                    onPress={completing ? undefined : () => confirmComplete(book)}
                    secondary
                  />
                </View>
                {completeError && <Text accessibilityRole="alert" style={styles.message}>{completeError}</Text>}
              </GlassSurface>
            )}
            {!reviews && !reviewError && <Text style={styles.message}>しおりを読み込んでいます…</Text>}
            {reviewError && (
              <View style={styles.error}>
                <Text accessibilityRole="alert" style={styles.message}>{reviewError}</Text>
                <ActionButton label="しおり一覧を再試行" onPress={() => setReviewVersion((version) => version + 1)} />
              </View>
            )}
            {reviews && (
              <BookmarkListCard
                key={`${bookId}:${book.latest_iteration}`}
                reviews={reviews}
                currentPage={book.current_page}
                onOpen={(page) => onNavigate({ name: 'bookmark', bookId, iteration: book.latest_iteration, page })}
                accentColor={emotionColor}
                tintColor={emotionTint}
              />
            )}
            {!emotions && !emotionError && <Text style={styles.message}>感情分析を読み込んでいます…</Text>}
            {emotionError && (
              <View style={styles.error}>
                <Text accessibilityRole="alert" style={styles.message}>{emotionError}</Text>
                <ActionButton label="感情分析を再試行" onPress={() => setReviewVersion((version) => version + 1)} />
              </View>
            )}
            {emotions && <EmotionAnalysisCard summary={emotions} />}
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
  completeAction: { marginTop: 16 },
  card: { backgroundColor: 'rgba(255, 255, 255, 0.48)', borderRadius: 16, elevation: 2, marginTop: 16, padding: 18, shadowColor: colors.black, shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { height: 1, width: 0 } },
});
