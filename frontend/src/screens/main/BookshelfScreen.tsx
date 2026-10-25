import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { BookCover } from '../../components/molecules/BookCover';
import { GlassSurface } from '../../components/atoms/GlassSurface';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import { getBooks, type Book } from '../../lib/api';
import { colors } from '../../theme/colors';
import type { Navigate } from '../types';

export function BookshelfScreen({ onNavigate }: { onNavigate: Navigate }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [bookFilter, setBookFilter] = useState('all');
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
    <ScreenFrame
      activeRoute="bookshelf"
      headerAction={(
        <Pressable
          accessibilityLabel="本を追加"
          accessibilityRole="button"
          onPress={() => onNavigate('add-book')}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
        >
          <Ionicons color={colors.text} name="add" size={22} />
        </Pressable>
      )}
      onNavigate={onNavigate}
      title="本棚"
      subtitle="あなたの本を整理しましょう"
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.filters}>
          {[
            { label: 'すべて', value: 'all' },
            { label: '読書中', value: 'reading' },
            { label: '読了', value: 'completed' },
          ].map((option) => {
            const isSelected = bookFilter === option.value;

            return (
              <GlassSurface key={option.value} intensity={18} style={[styles.filterSurface, isSelected && styles.activeFilterSurface]}>
                {isSelected && (
                  <Svg height="100%" pointerEvents="none" preserveAspectRatio="none" style={styles.filterGradient} viewBox="0 0 100 100" width="100%">
                    <Defs>
                      <LinearGradient id="bookshelfFilterGradient" x1="0" x2="1" y1="0" y2="1">
                        <Stop offset="0" stopColor="#FF8C8C" />
                        <Stop offset="0.45" stopColor="#DE7ECD" />
                        <Stop offset="1" stopColor={colors.navAccent} />
                      </LinearGradient>
                    </Defs>
                    <Rect fill="url(#bookshelfFilterGradient)" height="100" rx="12" width="100" />
                  </Svg>
                )}
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setBookFilter(option.value)}
                  style={styles.filter}
                >
                  <Text style={[styles.filterLabel, isSelected && styles.activeFilterLabel]}>{option.label}</Text>
                </Pressable>
              </GlassSurface>
            );
          })}
        </View>
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
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 110 },
  addButton: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.72)', borderColor: 'rgba(255, 255, 255, 0.9)', borderRadius: 20, borderWidth: 1, height: 40, justifyContent: 'center', marginTop: 2, width: 40 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.94 }] },
  filters: { flexDirection: 'row', gap: 10, marginBottom: 18, marginTop: 8 },
  filterSurface: { borderRadius: 16, elevation: 2, minHeight: 30, shadowColor: colors.black, shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { height: 2, width: 0 } },
  activeFilterSurface: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterGradient: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  filter: { alignItems: 'center', justifyContent: 'center', minHeight: 30, paddingHorizontal: 14 },
  filterLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  activeFilterLabel: { color: colors.background, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 26, marginBottom: 30 },
  book: { alignItems: 'center', width: '31%' },
  bookTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 10, textAlign: 'center', width: '100%' },
  message: { color: colors.textSecondary, fontSize: 14, marginBottom: 18 },
});
