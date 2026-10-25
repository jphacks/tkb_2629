import { colors } from "../../theme/colors";
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ReadingBookCard, readingBooks } from '../../components/molecules/ReadingBookCard';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import type { Navigate } from '../types';

export function BookmarkBookSelectScreen({ onNavigate }: { onNavigate: Navigate }) {
  return (
    <ScreenFrame
      activeRoute="home"
      headerAction={(
        <Pressable
          accessibilityLabel="本を追加"
          accessibilityRole="button"
          onPress={() => onNavigate('add-book')}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
        >
          <Ionicons color={colors.navAccent} name="add" size={24} />
        </Pressable>
      )}
      onNavigate={onNavigate}
      subtitle="本を選んで、読書の記録を残しましょう"
      title="しおりをはさむ本"
    >
      <ScrollView contentContainerStyle={styles.content} style={styles.scroll}>
        <View style={styles.bookList}>
          {readingBooks.map((book) => (
            <ReadingBookCard book={book} key={book.title} onPress={() => onNavigate('bookmark')} />
          ))}
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  addButton: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.72)', borderColor: 'rgba(255, 255, 255, 0.9)', borderRadius: 20, borderWidth: 1, height: 40, justifyContent: 'center', marginTop: 2, width: 40 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.94 }] },
  content: { padding: 24, paddingBottom: 32 },
  scroll: { flex: 1 },
  bookList: { gap: 12 },
});
