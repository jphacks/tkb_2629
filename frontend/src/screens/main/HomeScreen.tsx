import { StyleSheet, View } from 'react-native';

import { BookStack } from '../../components/molecules/BookStack';
import { FloatingActionButton } from '../../components/molecules/FloatingActionButton';
import { MyThoughtCard } from '../../components/molecules/MyThoughtCard';
import { allBookmarks, myBookmarks } from '../../components/organisms/BookmarkListCard';
import { getAggregateEmotionColor, getEmotionTint } from '../../components/organisms/EmotionAnalysisCard';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import type { ScreenKey } from '../types';

export function HomeScreen({ onNavigate }: { onNavigate: (route: ScreenKey) => void }) {
  const totalReadBooks = 12;
  const myThought = myBookmarks[0];
  const emotionColor = getAggregateEmotionColor(allBookmarks);
  const emotionTint = getEmotionTint(emotionColor);

  return (
    <ScreenFrame activeRoute="home" onNavigate={onNavigate} title="ホーム" subtitle="あなたの読書を、もっと身近に">
      <View style={styles.body}>
        <View style={styles.content}>
          <BookStack count={totalReadBooks} />
          {myThought && (
            <MyThoughtCard emotionColor={emotionColor} emotionTint={emotionTint} note={myThought.note} />
          )}
        </View>
        <FloatingActionButton onPress={() => onNavigate('bookmark-book-select')} />
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  content: { flex: 1, paddingBottom: 80 },
});
