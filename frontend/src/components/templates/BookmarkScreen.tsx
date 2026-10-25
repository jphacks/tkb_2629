import { useRef, useState } from 'react';
import { Animated, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../theme/colors';
import { BookmarkCard } from '../organisms/BookmarkCard';
import { BookmarkRibbon } from '../organisms/BookmarkRibbon';
import { BottomNavigation } from '../organisms/BottomNavigation';
import type { ScreenKey } from '../../screens/types';
import { savePageReview, type Book } from '../../lib/api';

type BookmarkScreenProps = {
  book: Book | null;
  iterationNumber: number | null;
  onNavigate?: (route: ScreenKey) => void;
};

export function BookmarkScreen({ book, iterationNumber, onNavigate }: BookmarkScreenProps) {
  const [isAdded, setIsAdded] = useState(false);
  const [savedPage, setSavedPage] = useState<number | null>(null);
  const translateY = useRef(new Animated.Value(0)).current;

  const resetBookmark = () => {
    translateY.setValue(0);
    setIsAdded(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.screen}>
        {!isAdded && <BookmarkRibbon translateY={translateY} />}
        {!isAdded && (
          <BookmarkCard
            bookTitle={book?.title}
            iterationNumber={iterationNumber ?? undefined}
            maxPage={book?.total_pages}
            onAdd={async (page, thoughts) => {
              if (book && iterationNumber) {
                await savePageReview(book.id, iterationNumber, page, thoughts);
              }
            }}
            onAdded={(page) => {
              setSavedPage(page);
              setIsAdded(true);
            }}
            translateY={translateY}
          />
        )}
        {isAdded && (
          <View style={styles.successState}>
            <Ionicons color={colors.navAccent} name="checkmark-circle" size={56} />
            <Text style={styles.successTitle}>しおりを追加しました</Text>
            {iterationNumber && savedPage && (
              <Text style={styles.successDetail}>{iterationNumber}回目 ・ {savedPage}ページ</Text>
            )}
            <Pressable onPress={resetBookmark} style={styles.resetButton}>
              <Text style={styles.resetButtonText}>もう一度追加</Text>
            </Pressable>
          </View>
        )}
        <BottomNavigation activeRoute="bookmark" onNavigate={onNavigate} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  screen: { backgroundColor: colors.background, flex: 1 },
  successState: { alignItems: 'center', left: 0, position: 'absolute', right: 0, top: 270 },
  successTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: 14 },
  successDetail: { color: colors.placeholder, fontSize: 14, marginTop: 8 },
  resetButton: { backgroundColor: colors.accent, borderRadius: 12, marginTop: 20, paddingHorizontal: 22, paddingVertical: 12 },
  resetButtonText: { color: colors.background, fontSize: 14, fontWeight: '700' },
});
