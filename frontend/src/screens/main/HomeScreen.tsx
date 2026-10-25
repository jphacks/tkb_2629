import { StyleSheet, View } from 'react-native';

import { BookStack } from '../../components/molecules/BookStack';
import { FloatingActionButton } from '../../components/molecules/FloatingActionButton';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import type { Navigate } from '../types';

export function HomeScreen({ onNavigate }: { onNavigate: Navigate }) {
  const totalReadBooks = 12;

  return (
    <ScreenFrame activeRoute="home" onNavigate={onNavigate} title="ホーム" subtitle="あなたの読書を、もっと身近に">
      <View style={styles.body}>
        <View style={styles.content}>
          <BookStack count={totalReadBooks} />
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
