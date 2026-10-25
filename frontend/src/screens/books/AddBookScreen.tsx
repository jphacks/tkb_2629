import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../components/molecules/ActionButton';
import { BookCover } from '../../components/molecules/BookCover';
import { ShadowInput } from '../../components/atoms/ShadowInput';
import { GlassSurface } from '../../components/atoms/GlassSurface';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import {
  importGoogleBook,
  searchGoogleBooks,
  type GoogleBook,
} from '../../lib/api';
import type { Navigate, ScreenKey } from '../types';

type AddBookScreenProps = {
  onNavigate: Navigate;
  activeRoute?: ScreenKey;
  title?: string;
  subtitle?: string;
};

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
  const [importedIds, setImportedIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const searchRequestId = useRef(0);

  async function search() {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      setMessage('検索するタイトルを入力してください。');
      return;
    }
    const requestId = searchRequestId.current + 1;
    searchRequestId.current = requestId;
    setSearching(true);
    setMessage(null);
    try {
      const books = await searchGoogleBooks(normalizedQuery);
      if (requestId !== searchRequestId.current) {
        return;
      }
      setResults(books);
      if (books.length === 0) {
        setMessage('ページ数を確認できる書籍が見つかりませんでした。');
      }
    } catch (error) {
      if (requestId !== searchRequestId.current) {
        return;
      }
      setResults([]);
      setMessage(error instanceof Error ? error.message : '書籍検索に失敗しました。');
    } finally {
      if (requestId === searchRequestId.current) {
        setSearching(false);
      }
    }
  }

  async function addBook(book: GoogleBook) {
    setImportingId(book.google_books_id);
    setMessage(null);
    try {
      await importGoogleBook(book.google_books_id);
      setImportedIds((current) => [...current, book.google_books_id]);
      setMessage(`「${book.title}」を本棚に追加しました。`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      setMessage(
        errorMessage === 'Book is already in the bookshelf'
          ? `「${book.title}」はすでに本棚へ追加されています。`
          : errorMessage || '本棚への追加に失敗しました。',
      );
    } finally {
      setImportingId(null);
    }
  }

  return (
    <ScreenFrame
      activeRoute={activeRoute}
      onNavigate={onNavigate}
      title={title}
      subtitle={subtitle}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ShadowInput
          onChangeText={setQuery}
          onSubmitEditing={search}
          placeholder="本のタイトルを検索"
          returnKeyType="search"
          value={query}
          style={styles.search}
        />
        <ActionButton label={searching ? '検索中…' : '検索する'} onPress={searching ? undefined : search} />
        {message && <Text style={styles.message}>{message}</Text>}
        {results.length > 0 && (
          <Text style={styles.resultCount}>検索結果 {results.length}件</Text>
        )}
        {results.map((book) => (
          <Pressable
            disabled={importingId !== null || importedIds.includes(book.google_books_id)}
            key={book.google_books_id}
            onPress={() => addBook(book)}
            style={[
              styles.result,
              importedIds.includes(book.google_books_id) && styles.importedResult,
            ]}
          >
            <View style={styles.book}>
              <BookCover title={book.title} author={book.author ?? '著者不明'} />
              <View style={styles.bookDetails}>
                <Text style={styles.title}>{book.title}</Text>
                <Text style={styles.body}>{book.author ?? '著者不明'}</Text>
                <Text style={styles.body}>{book.total_pages}ページ</Text>
                <Text style={styles.tap}>
                  {importedIds.includes(book.google_books_id)
                    ? '追加済み'
                    : importingId === book.google_books_id
                      ? '追加中…'
                      : 'タップして本棚に追加'}
                </Text>
              </View>
            </View>
          </Pressable>
        ))}
        {message?.includes('追加しました') && (
          <ActionButton label="本棚へ戻る" onPress={() => onNavigate('bookshelf')} />
        )}
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14, padding: 24, paddingBottom: 110 },
  search: { height: 52, marginTop: 8, width: '100%' },
  message: { color: '#777777', fontSize: 14, lineHeight: 20 },
  resultCount: { color: '#464646', fontSize: 16, fontWeight: '700', marginTop: 8 },
  result: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    elevation: 2,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { height: 1, width: 0 },
  },
  importedResult: { opacity: 0.55 },
  book: { alignItems: 'center', flexDirection: 'row', gap: 18 },
  bookDetails: { flex: 1 },
  title: { color: '#464646', fontSize: 16, fontWeight: '700' },
  body: { color: '#9CA3AF', fontSize: 13, marginTop: 5 },
  tap: { color: '#C17AED', fontSize: 13, fontWeight: '700', marginTop: 9 },
});
