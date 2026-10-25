import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '../../theme/colors';
import { BookCover } from './BookCover';
import { GlassSurface } from '../atoms/GlassSurface';

type MyThoughtCardProps = {
  emotionColor: string;
  emotionTint: string;
  note: string;
};

export function MyThoughtCard({ emotionColor, emotionTint, note }: MyThoughtCardProps) {
  return (
    <GlassSurface style={styles.card}>
      <BookCover color={emotionColor} compact title="星の旅" />
      <View style={styles.bubbleWrap}>
        <View style={[styles.tail, { borderRightColor: emotionColor }]} />
        <View style={[styles.tailInner, { borderRightColor: emotionTint }]} />
        <GlassSurface intensity={22} style={[styles.bubble, { backgroundColor: emotionTint }]}>
          <Svg pointerEvents="none" preserveAspectRatio="none" style={StyleSheet.absoluteFill} viewBox="0 0 100 100">
            <Defs>
              <RadialGradient cx="50%" cy="50%" id="thoughtEdgeTint" r="72%">
                <Stop offset="0" stopColor={emotionColor} stopOpacity="0" />
                <Stop offset="0.68" stopColor={emotionColor} stopOpacity="0.03" />
                <Stop offset="1" stopColor={emotionColor} stopOpacity="0.3" />
              </RadialGradient>
            </Defs>
            <Rect fill="url(#thoughtEdgeTint)" height="100" width="100" />
          </Svg>
          <Text style={styles.label}>星の旅 42ページ</Text>
          <Text numberOfLines={2} style={styles.note}>{note}</Text>
        </GlassSurface>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', borderRadius: 18, flexDirection: 'row', gap: 14, marginTop: 16, paddingHorizontal: 16, paddingVertical: 12 },
  bubbleWrap: { flex: 1, justifyContent: 'center', minHeight: 84, position: 'relative' },
  bubble: { backgroundColor: 'rgba(255, 255, 255, 0.36)', borderColor: 'rgba(255, 255, 255, 0.86)', 
    borderRadius: 16, borderWidth: 1, elevation: 3, paddingHorizontal: 16, paddingVertical: 12, shadowColor: colors.black, shadowOffset: { height: 2, width: 0 }, shadowOpacity: 0.1, shadowRadius: 7 },
  tail: { borderBottomColor: 'transparent', borderBottomWidth: 11, borderLeftWidth: 0, borderRightWidth: 14, borderTopColor: 'transparent', borderTopWidth: 11, height: 0, left: -10, position: 'absolute', top: '50%', transform: [{ translateY: -11 }], width: 0, zIndex: 2 },
  tailInner: { borderBottomColor: 'transparent', borderBottomWidth: 10, borderLeftWidth: 0, borderRightWidth: 12, borderTopColor: 'transparent', borderTopWidth: 9, height: 0, left: -8, position: 'absolute', top: '50%', transform: [{ translateY: -9.5 }], width: 0, zIndex: 3 },
  label: { color: colors.text, fontSize: 11, fontWeight: '700' },
  note: { color: colors.text, fontSize: 12, lineHeight: 18, marginTop: 8 },
});
