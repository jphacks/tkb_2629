import { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../theme/colors';
import { BookmarkCard } from '../organisms/BookmarkCard';
import { BookmarkRibbon } from '../organisms/BookmarkRibbon';
import { ScreenFrame } from '../organisms/ScreenFrame';
import type { ScreenKey } from '../../screens/types';

type BookmarkScreenProps = { onNavigate?: (route: ScreenKey) => void };

export function BookmarkScreen({ onNavigate }: BookmarkScreenProps) {
  const [isAdded, setIsAdded] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;

  const resetBookmark = () => {
    translateY.setValue(0);
    setIsAdded(false);
  };

  return (
    <ScreenFrame activeRoute="bookmark" onNavigate={onNavigate}>
      <View style={styles.content}>
        {!isAdded && <BookmarkRibbon translateY={translateY} />}
        {!isAdded && <BookmarkCard onAdded={() => setIsAdded(true)} translateY={translateY} />}
        {isAdded && (
          <View style={styles.successState}>
            <Ionicons color={colors.navAccent} name="checkmark-circle" size={56} />
            <Text style={styles.successTitle}>しおりを追加しました</Text>
            <Pressable onPress={resetBookmark} style={styles.resetButton}>
              <Text style={styles.resetButtonText}>もう一度追加</Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { backgroundColor: '#F7F4FF', flex: 1, position: 'relative',marginTop: 24 },
  successState: { alignItems: 'center', left: 0, position: 'absolute', right: 0, top: 270 },
  successTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: 14 },
  resetButton: { backgroundColor: colors.accent, borderRadius: 12, marginTop: 20, paddingHorizontal: 22, paddingVertical: 12 },
  resetButtonText: { color: colors.background, fontSize: 14, fontWeight: '700' },
});
