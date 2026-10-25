import { colors } from "../../theme/colors";
import { StyleSheet, Text, View } from 'react-native';

import type { Bookmark } from '../../types/bookmark';

type BookmarkCalloutProps = { accentColor?: string; bookmark: Bookmark; position: number; tintColor?: string };

export function BookmarkCallout({ accentColor = colors.accent, bookmark, position, tintColor = '#FFE0E0' }: BookmarkCalloutProps) {
  return (
    <View pointerEvents="none" style={[styles.container, { borderColor: tintColor, left: `${Math.max(0, Math.min(68, position - 12))}%` }]}> 
      <View style={[styles.pointer, { borderBottomColor: tintColor, borderRightColor: tintColor }]} />
      <Text style={styles.body}>{bookmark.note}</Text>
      <Text style={[styles.meta, { color: accentColor }]}>{bookmark.page}ページ ・ {bookmark.date}</Text>
      <Text style={styles.author}>{bookmark.author}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, borderColor: '#FFE0E0', borderRadius: 12, borderWidth: 1, elevation: 4, padding: 10, position: 'absolute', top: 0, width: 150, zIndex: 3 },
  pointer: { backgroundColor: colors.background, borderBottomColor: '#FFE0E0', borderBottomWidth: 1, borderRightColor: '#FFE0E0', borderRightWidth: 1, bottom: -6, height: 10, left: 24, position: 'absolute', transform: [{ rotate: '45deg' }], width: 10 },
  title: { color: colors.text, fontSize: 12, fontWeight: '700' },
  meta: { color: colors.accent, fontSize: 10, marginTop: 3 },
  body: { color: colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 5 },
  author: { color: '#A1A1AA', fontSize: 10, marginTop: 6 },
});
