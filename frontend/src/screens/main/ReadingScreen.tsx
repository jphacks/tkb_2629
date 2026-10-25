import { ScrollView, StyleSheet, View } from 'react-native';

import { ReadingBookCard, readingBooks } from '../../components/molecules/ReadingBookCard';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import type { ScreenKey } from '../types';

export function ReadingScreen({ onNavigate }: { onNavigate: (route: ScreenKey) => void }) {
  return (
    <ScreenFrame activeRoute="reading" onNavigate={onNavigate} title="今読んでる本" subtitle="読書の続きを記録しましょう">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.bookGrid}>
          {readingBooks.map((book) => (
            <ReadingBookCard book={book} key={book.title} onPress={() => onNavigate('book-detail')} />
          ))}
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 110 },
  bookGrid: { gap: 12, marginTop: 8 },
});
