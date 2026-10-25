import { colors } from "../../theme/colors";
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { ActionButton } from '../../components/molecules/ActionButton';
import { BookCover } from '../../components/molecules/BookCover';
import { ShadowInput } from '../../components/atoms/ShadowInput';
import { SearchHistory } from '../../components/molecules/SearchHistory';
import { useSearchHistory } from '../../lib/searchHistory';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import { PopularBooks } from '../../components/organisms/PopularBooks';
import { EmotionRecommendations } from '../../components/organisms/EmotionRecommendations';
import { BookmarkScreen } from '../../components/templates/BookmarkScreen';
import {
  importGoogleBook,
  searchGoogleBooks,
  type Book,
  type GoogleBook,
} from '../../lib/api';
import { loadAllBooks } from '../../lib/readingBooks';
import { shelfStatusLabel } from '../../lib/readingStatus';
import type { Navigate, Route, ScreenKey } from '../types';
import { BookPreviewScreen } from './BookPreviewScreen';
import { BookDetailScreen } from './BookDetailScreen';

type AddBookScreenProps = {
  onNavigate: Navigate;
  activeRoute?: ScreenKey;
  title?: string;
  subtitle?: string;
};

const genres = ['小説', 'ミステリー', 'SF', 'ファンタジー', 'エッセイ', '歴史', 'ビジネス', '科学'];

export function AddBookScreen({
  onNavigate,
  activeRoute = 'bookshelf',
  title = '本の新規追加',
  subtitle = 'Google Booksから本を検索して追加します',
}: AddBookScreenProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GoogleBook[]>([]);
  const [searching, setSearching] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [ownedBooks, setOwnedBooks] = useState<Record<string, Book>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<GoogleBook | null>(null);
  const [detailBookId, setDetailBookId] = useState<number | null>(null);
  const [bookmark, setBookmark] = useState<Extract<Route, { name: 'bookmark' }> | null>(null);
  const searchRequestId = useRef(0);
  const history = useSearchHistory('catalog');

  // Shelf status on results is supplementary, so a failure here only hides it.
  useEffect(() => {
    let active = true;
    loadAllBooks(() => active)
      .then((books) => {
        if (!active || !books) return;
        const owned: Record<string, Book> = {};
        for (const book of books) {
          if (book.google_books_id) owned[book.google_books_id] = book;
        }
        setOwnedBooks((current) => ({ ...owned, ...current }));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function search(value = query) {
    const normalizedQuery = value.trim();
    if (!normalizedQuery) {
      setMessage('検索するタイトルを入力してください');
      return;
    }
    const requestId = searchRequestId.current + 1;
    searchRequestId.current = requestId;
    setSearching(true);
    setMessage(null);
    setQuery(normalizedQuery);
    void history.remember(normalizedQuery);
    try {
      const books = await searchGoogleBooks(normalizedQuery);
      if (requestId !== searchRequestId.current) {
        return;
      }
      setResults(books);
      if (books.length === 0) {
        setMessage('ページ数を確認できる書籍が見つかりませんでした');
      }
    } catch (error) {
      if (requestId !== searchRequestId.current) {
        return;
      }
      setResults([]);
      setMessage(error instanceof Error ? error.message : '書籍検索に失敗しました');
    } finally {
      if (requestId === searchRequestId.current) {
        setSearching(false);
      }
    }
  }

  async function addBook(book: GoogleBook) {
    if (importingId !== null || ownedBooks[book.google_books_id]) return;
    setImportingId(book.google_books_id);
    setMessage(null);
    try {
      const imported = await importGoogleBook(book.google_books_id);
      setOwnedBooks((current) => ({ ...current, [book.google_books_id]: imported }));
      setMessage(`「${book.title}」を本棚に追加しました`);
      setDetailBookId(imported.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      setMessage(
        errorMessage === 'Book is already in the bookshelf'
          ? `「${book.title}」はすでに本棚へ追加されています`
          : errorMessage || '本棚への追加に失敗しました',
      );
    } finally {
      setImportingId(null);
    }
  }

  function openDiscoveredBook(book: GoogleBook) {
    const owned = ownedBooks[book.google_books_id];
    setMessage(null);
    if (owned) setDetailBookId(owned.id);
    else setPreview(book);
  }

  const navigate: Navigate = (target) => {
    if (typeof target !== 'string' && target.name === 'book-detail') {
      setBookmark(null);
      setDetailBookId(target.bookId);
    } else if (typeof target !== 'string' && target.name === 'bookmark' && target.bookId !== undefined) {
      setBookmark(target);
    } else {
      onNavigate(target);
    }
  };

  if (bookmark) {
    return (
      <BookmarkScreen
        bookId={bookmark.bookId}
        iteration={bookmark.iteration}
        initialPage={bookmark.page}
        onNavigate={navigate}
        onBack={() => setBookmark(null)}
      />
    );
  }

  if (detailBookId !== null) {
    return (
      <BookDetailScreen
        bookId={detailBookId}
        onNavigate={navigate}
        onBack={() => setDetailBookId(null)}
      />
    );
  }

  if (preview) {
    return (
      <BookPreviewScreen
        book={preview}
        owned={ownedBooks[preview.google_books_id]}
        adding={importingId !== null}
        message={message}
        activeRoute={activeRoute}
        onNavigate={navigate}
        onBack={() => setPreview(null)}
        onAdd={() => { void addBook(preview); }}
      />
    );
  }

  return (
    <ScreenFrame
      activeRoute={activeRoute}
      onNavigate={onNavigate}
      title={title}
      subtitle={subtitle}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.searchRow}>
          <ShadowInput
            onChangeText={setQuery}
            onSubmitEditing={() => { void search(); }}
            placeholder="本のタイトルを検索"
            returnKeyType="search"
            value={query}
            style={styles.search}
          />
          <Pressable
            accessibilityLabel="検索する"
            accessibilityRole="button"
            disabled={searching}
            onPress={() => { void search(); }}
            style={({ pressed }) => [styles.searchButton, pressed && styles.searchButtonPressed]}
          >
            <Svg height="100%" pointerEvents="none" preserveAspectRatio="none" style={styles.searchGradient} viewBox="0 0 100 100" width="100%">
              <Defs>
                <LinearGradient id="searchButtonGradient" x1="0" x2="1" y1="0" y2="1">
                  <Stop offset="0" stopColor={colors.navAccent} />
                  <Stop offset="0.45" stopColor={colors.navAccent} />
                  <Stop offset="1" stopColor={colors.navAccent} />
                </LinearGradient>
              </Defs>
              <Rect fill="url(#searchButtonGradient)" height="100" rx="12" width="100" />
            </Svg>
            <Ionicons color={colors.background} name="search" size={21} />
          </Pressable>
        </View>
        <View style={styles.genres}>
          <Text style={styles.genreHeading}>ジャンルから探す</Text>
          <Text style={styles.genreHint}>ジャンル名でキーワード検索します</Text>
          <View style={styles.genreList}>
            {genres.map((genre) => (
              <Pressable
                key={genre}
                accessibilityLabel={`${genre}の本を探す`}
                accessibilityRole="button"
                onPress={() => { void search(genre); }}
                style={({ pressed }) => [styles.genreButton, pressed && styles.searchButtonPressed]}
              >
                <Text style={styles.genreLabel}>{genre}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <PopularBooks onSelect={openDiscoveredBook} />
        <EmotionRecommendations onSelect={openDiscoveredBook} />
        <SearchHistory
          items={history.items} error={history.error} loading={history.loading}
          onSelect={(value) => { void search(value); }}
          onRemove={(value) => { void history.remove(value); }}
          onClear={() => { void history.clear(); }}
        />
        {message && <Text style={styles.message}>{message}</Text>}
        {results.length > 0 && (
          <Text style={styles.resultCount}>検索結果 {results.length}件</Text>
        )}
        {results.map((book) => {
          const owned = ownedBooks[book.google_books_id];
          return (
            <View
              accessibilityLabel={`${book.title}の検索結果`}
              key={book.google_books_id}
              style={styles.result}
            >
              <View style={styles.book}>
                <BookCover title={book.title} author={book.author ?? '著者不明'} />
                <View style={styles.bookDetails}>
                  <Text style={styles.title}>{book.title}</Text>
                  <Text style={styles.body}>{book.author ?? '著者不明'}</Text>
                  <Text style={styles.body}>{book.total_pages}ページ</Text>
                  {owned && <Text style={styles.status}>{shelfStatusLabel(owned)}</Text>}
                  <View style={styles.actions}>
                      <Pressable
                        accessibilityLabel={`${book.title}の詳細を見る`}
                        accessibilityRole="button"
                        onPress={() => {
                          if (owned) {
                            setDetailBookId(owned.id);
                          } else {
                            setMessage(null);
                            setPreview(book);
                          }
                        }}
                        style={({ pressed }) => [styles.detailButton, pressed && styles.searchButtonPressed]}
                      >
                        <Text style={styles.detailLabel}>詳細を見る</Text>
                      </Pressable>
                      <Pressable
                        accessibilityLabel={`${book.title}を追加する`}
                        accessibilityRole="button"
                        disabled={importingId !== null || owned !== undefined}
                        onPress={() => {
                          void addBook(book);
                        }}
                        style={({ pressed }) => [styles.detailButton, owned && styles.addedButton, pressed && styles.searchButtonPressed]}
                      >
                        <Text style={[styles.detailLabel, owned && styles.addedLabel]}>
                          {owned ? '追加済み' : importingId === book.google_books_id ? '追加中…' : 'タップして本棚に追加'}
                        </Text>
                      </Pressable>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
        {message?.includes('追加しました') && (
          <ActionButton label="本棚へ戻る" onPress={() => onNavigate('bookshelf')} />
        )}
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14, padding: 24, paddingBottom: 110 },
  searchRow: { marginTop: 8, position: 'relative' },
  search: { height: 52, paddingRight: 58, width: '100%' },
  searchButton: { alignItems: 'center', backgroundColor: colors.navAccent, borderRadius: 12, height: 40, justifyContent: 'center', overflow: 'hidden', position: 'absolute', right: 6, top: 6, width: 40 },
  searchGradient: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  searchButtonPressed: { opacity: 0.72, transform: [{ scale: 0.94 }] },
  genres: { gap: 8 },
  genreHeading: { color: colors.text, fontSize: 15, fontWeight: '700' },
  genreHint: { color: colors.textSecondary, fontSize: 12 },
  genreList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  genreButton: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, backgroundColor: colors.backgroundSoft },
  genreLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  message: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  resultCount: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 8 },
  result: {
    backgroundColor: colors.background,
    borderRadius: 18,
    elevation: 2,
    padding: 16,
    shadowColor: colors.black,
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { height: 1, width: 0 },
  },

  book: { alignItems: 'center', flexDirection: 'row', gap: 18 },
  bookDetails: { flex: 1 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  body: { color: colors.placeholder, fontSize: 13, marginTop: 5 },
  status: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 9 },
  actions: { gap: 16, marginTop: 16 },
  detailButton: { alignItems: 'center', justifyContent: 'center', borderColor: colors.navAccent, borderRadius: 14, borderWidth: 1, minHeight: 48, paddingHorizontal: 12, paddingVertical: 10 },
  detailLabel: { color: colors.navAccent, fontSize: 13, fontWeight: '700' },
  addedButton: { backgroundColor: colors.navAccent },
  addedLabel: { color: colors.background },
});
