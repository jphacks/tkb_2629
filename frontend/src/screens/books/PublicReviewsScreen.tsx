import { ScrollView, StyleSheet } from 'react-native';

import { BackButton } from '../../components/molecules/BackButton';
import { PublicReviewList } from '../../components/organisms/PublicReviewList';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import type { Navigate } from '../types';

export function PublicReviewsScreen({ bookId, onNavigate, onBack }: {
  bookId: number; onNavigate: Navigate; onBack?: () => void;
}) {
  return (
    <ScreenFrame activeRoute="bookshelf" onNavigate={onNavigate} title="みんなのしおり"
      headerLeading={<BackButton onPress={onBack ?? (() => onNavigate({ name: 'book-detail', bookId }))} />}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <PublicReviewList bookId={bookId} />
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 110 },
});
