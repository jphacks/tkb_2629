import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BookCover } from '../../components/molecules/BookCover';
import { ReadingProgress } from '../../components/molecules/ReadingProgress';
import { GlassSurface } from '../../components/atoms/GlassSurface';
import { EmotionAnalysisCard, getAggregateEmotionColor, getEmotionTint } from '../../components/organisms/EmotionAnalysisCard';
import { allBookmarks, BookmarkListCard } from '../../components/organisms/BookmarkListCard';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import type { ScreenKey } from '../types';

export function BookDetailScreen({ onNavigate }: { onNavigate: (route: ScreenKey) => void }) {
  const emotionColor = getAggregateEmotionColor(allBookmarks);
  const emotionTint = getEmotionTint(emotionColor);

  return (
    <ScreenFrame activeRoute="bookshelf" onNavigate={onNavigate} title="本の詳細">
      <ScrollView contentContainerStyle={styles.content}>
        <GlassSurface style={styles.hero}>
          <Pressable accessibilityLabel="本の情報を編集" accessibilityRole="button" onPress={() => onNavigate('book-edit')} style={styles.editButton}>
            <Ionicons color={emotionColor} name="pencil" size={22} />
          </Pressable>
          <BookCover large title="星の旅" />
          <View style={styles.info}>
            <Text style={styles.title}>星の旅</Text>
            <Text style={styles.author}>著者名</Text>
            <Text style={styles.publisher}>出版社 ・ 2025年</Text>
          </View>
        </GlassSurface>
        <GlassSurface style={styles.card}>
          <ReadingProgress color={emotionColor} currentPage={42} totalPages={180} />
        </GlassSurface>
        <BookmarkListCard accentColor={emotionColor} tintColor={emotionTint} />
        <EmotionAnalysisCard bookmarks={allBookmarks} />
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 110 },
  hero: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.48)', borderRadius: 20, flexDirection: 'row', marginTop: 8, padding: 18, position: 'relative' },
  info: { flex: 1, marginLeft: 18, justifyContent: 'center' },
  editButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 18, elevation: 2, height: 36, justifyContent: 'center', position: 'absolute', right: 14, top: 14, width: 36 },
  title: { color: '#464646', fontSize: 24, fontWeight: '700'},
  author: { color: '#777777', fontSize: 14, marginTop: 8 },
  publisher: { color: '#9CA3AF', fontSize: 12, marginTop: 6 },
  card: { backgroundColor: 'rgba(255, 255, 255, 0.48)', borderRadius: 16, elevation: 2, marginTop: 16, padding: 18, shadowColor: '#000000', shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { height: 1, width: 0 } },
});
