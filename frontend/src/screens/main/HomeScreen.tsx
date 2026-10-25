import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BookStack } from '../../components/molecules/BookStack';
import { FloatingActionButton } from '../../components/molecules/FloatingActionButton';
import { MyThoughtCard } from '../../components/molecules/MyThoughtCard';
import { myBookmarks } from '../../components/organisms/BookmarkListCard';
import { getEmotionTint } from '../../components/organisms/EmotionAnalysisCard';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import { loadReadingBooks } from '../../lib/readingBooks';
import type { Navigate } from '../types';

export function HomeScreen({ onNavigate }: { onNavigate: Navigate }) {
  const totalReadBooks = 12;
  const myThought = myBookmarks[0];
  const emotionColor = myThought?.color ?? '#8C8C8C';
  const emotionTint = getEmotionTint(emotionColor);
  const [opening, setOpening] = useState(false);

  // One reading book: open its bookmark input directly. Otherwise let the user choose on 今読んでいる本.
  async function openBookmark() {
    if (opening) return;
    setOpening(true);
    try {
      const books = await loadReadingBooks();
      const [book] = books ?? [];
      if (books?.length === 1 && book) {
        onNavigate({ name: 'bookmark', bookId: book.id, iteration: book.latest_iteration });
        return;
      }
    } catch {
      // The reading screen shows the error and a retry button.
    }
    setOpening(false);
    onNavigate('reading');
  }

  return (
    <ScreenFrame activeRoute="home" onNavigate={onNavigate} title="ホーム" subtitle="あなたの読書を、もっと身近に">
      <View style={styles.body}>
        <View style={styles.content}>
          <BookStack count={totalReadBooks} />
          {myThought && (
            <MyThoughtCard
              emotionColor={emotionColor}
              emotionTint={emotionTint}
              note={myThought.note}
              onPress={() => onNavigate({ name: 'book-detail', bookId: 1 })}
            />
          )}
        </View>
        <FloatingActionButton onPress={openBookmark} />
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  content: { flex: 1, paddingBottom: 80 },
});
