import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { PublicReviewDistribution, ReviewPageRange } from '../../lib/api';
import { rangeReviewBins } from '../../lib/reviewDistribution';
import { colors } from '../../theme/colors';

type Props = {
  totalPages: number;
  distribution: PublicReviewDistribution;
  range?: ReviewPageRange;
  onSelect: (range: ReviewPageRange) => void;
};

export function ReviewDistributionChart({ totalPages, distribution, range, onSelect }: Props) {
  const [width, setWidth] = useState(280);
  const columns = Math.max(1, Math.min(12, Math.floor(width / 44)));
  const bins = rangeReviewBins(totalPages, columns, distribution, range);
  const maximum = Math.max(1, ...bins.map((bin) => bin.count));
  const start = range?.start ?? 1;
  const end = range?.end ?? totalPages;
  const count = bins.reduce((sum, bin) => sum + bin.count, 0);
  const pages = range ? distribution.items.filter((item) => item.page_number >= start && item.page_number <= end) : [];

  return (
    <View style={styles.container} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <Text style={styles.heading}>{range ? `${start}〜${end}ページ・${count}件` : '本全体の感想の分布'}</Text>
      <Text style={styles.hint}>{"棒が高いほど感想が多い場所です\nタップすると詳しく見られます"}</Text>
      <View style={styles.chart} accessibilityLabel="みんなのしおりの分布">
        {bins.map((bin) => (
          <Pressable
            key={bin.start}
            accessibilityRole="button"
            accessibilityLabel={`${bin.start}〜${bin.end}ページ、感想${bin.count}件`}
            accessibilityState={{ disabled: bin.count === 0, selected: start === bin.start && end === bin.end }}
            disabled={bin.count === 0}
            onPress={() => onSelect({ start: bin.start, end: bin.end })}
            style={({ pressed }) => [styles.column, pressed && styles.pressed]}
          >
            <Text style={styles.count}>{bin.count > 0 ? bin.count : ''}</Text>
            <View style={[styles.bar, { height: bin.count / maximum * 88 }]} />
          </Pressable>
        ))}
      </View>
      <View style={styles.axis}>
        <Text style={styles.hint}>{end}ページ</Text>
        <Text style={styles.hint}>{start}ページ</Text>
      </View>
      {range && pages.length > 0 && (
        <ScrollView style={styles.pages} nestedScrollEnabled accessibilityLabel="この範囲のページを選択">
          {pages.map((page) => (
            <Pressable
              key={page.page_number}
              accessibilityRole="button"
              accessibilityLabel={`${page.page_number}ページの感想${page.review_count}件を読む`}
              onPress={() => onSelect({ start: page.page_number, end: page.page_number })}
              style={styles.page}
            >
              <Text style={styles.pageLabel}>{page.page_number}ページ</Text>
              <Text style={styles.hint}>{page.review_count}件</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  heading: { color: colors.text, fontSize: 15, fontWeight: '700' },
  hint: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  chart: { height: 120, flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: 2, borderBottomColor: colors.borderMuted },
  column: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 3 },
  count: { color: colors.text, fontSize: 11, marginBottom: 4 },
  bar: { backgroundColor: colors.navAccent, width: '100%', maxWidth: 32, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  pressed: { opacity: 0.65 },
  pages: { maxHeight: 192 },
  page: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#E8E0EF' },
  pageLabel: { color: colors.text, fontSize: 14 },
});
