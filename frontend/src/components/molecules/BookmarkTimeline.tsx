import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BookmarkCallout } from './BookmarkCallout';
import type { Bookmark } from '../../types/bookmark';

type BookmarkTimelineProps = { bookmarks: Bookmark[]; selectedBookmark?: Bookmark; onSelect: (id: string) => void };

export function BookmarkTimeline({ bookmarks, selectedBookmark, onSelect }: BookmarkTimelineProps) {
  return (
    <>
      <View style={styles.timeline}>
        <View style={styles.line} />
        {bookmarks.map((bookmark) => (
          <Pressable key={bookmark.id} accessibilityLabel={`${bookmark.page}ページのしおり`} accessibilityRole="button" onPress={() => onSelect(bookmark.id)} style={[styles.marker, { left: `${bookmark.position}%` }]}>
            <View style={[styles.dot, selectedBookmark?.id === bookmark.id && styles.selectedDot]} />
            <Text style={styles.page}>{bookmark.page}p</Text>
          </Pressable>
        ))}
        {selectedBookmark && <BookmarkCallout bookmark={selectedBookmark} position={selectedBookmark.position} />}
      </View>
      <View style={styles.labels}><Text>1ページ</Text><Text>180ページ</Text></View>
    </>
  );
}

const styles = StyleSheet.create({
  timeline: { height: 180, marginTop: 14, position: 'relative' },
  line: { backgroundColor: '#FFD6D6', height: 3, left: 0, position: 'absolute', right: 0, top: 110 },
  marker: { alignItems: 'center', position: 'absolute', top: 100, transform: [{ translateX: -18 }], width: 36, zIndex: 2 },
  dot: { backgroundColor: '#FF7171', borderColor: '#FFFFFF', borderRadius: 10, borderWidth: 3, height: 20, width: 20 },
  selectedDot: { borderColor: '#464646', borderWidth: 4 },
  page: { color: '#9CA3AF', fontSize: 10, marginTop: 5 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -2 },
});
