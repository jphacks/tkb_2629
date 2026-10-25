import { colors } from "../../theme/colors";
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

import { GlassSurface } from '../atoms/GlassSurface';

type BookStackProps = {
  count: number;
};

export function bookStackLayers(count: number): number {
  // Compress large counts so the tower grows without overflowing the card.
  return count <= 10 ? count : Math.min(32, 10 + Math.floor(3 * Math.log2(count / 10)));
}
const bookGradients = [
  { end: '#DFA9F0', start: '#c07aef' },
  { end: '#AFC9F5', start: '#709deb' },
  { end: '#F2AAC6', start: '#e66e9c' },
  { end: '#F4D78A', start: '#d3a954' },
  { end: '#A4D9B9', start: '#58be8d' },
  { end: '#F1B08D', start: '#D87544' },
];

export function bookTowerGeometry(count: number, column: number) {
  const layers = bookStackLayers(count);
  const rear = Math.max(0, Math.floor((layers - 10) / 3));
  const front = layers - rear * 2;
  const size = column < 2 ? Math.floor(front / 2) + (column === 0 ? front % 2 : 0) : rear;
  let bottom = 300;
  return Array.from({ length: size }, (_, index) => {
    const thickness = [12, 17, 10, 15, 13][(index + column) % 5]!;
    const width = [114, 124, 106, 118, 110, 126][(index + column) % 6]!;
    const left = (144 - width) / 2 + ((index % 3) - 1) * 2;
    const book = { bottom, thickness, width, left };
    bottom -= thickness;
    return book;
  });
}

function BookSvg({ gradient, id, width: w, thickness: t }: {
  gradient: { end: string; start: string }; id: string; width: number; thickness: number;
}) {
  const b = 8 + t;
  return (
    <G>
      <Defs>
        <LinearGradient id={`${id}-cover`} x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor={gradient.end} />
          <Stop offset="1" stopColor={gradient.start} />
        </LinearGradient>
        <LinearGradient id={`${id}-pages`} x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor="#FFFCF4" />
          <Stop offset="1" stopColor="#D6CDBD" />
        </LinearGradient>
      </Defs>
      <Path d={`M0 8 12 0H${w + 12}L${w} 8Z`} fill={gradient.end} />
      <Path d={`M0 8 12 0H${w + 12}`} fill="none" stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={0.8} />
      <Path d={`M${w} 8 ${w + 12} 0V${t}L${w} ${b}Z`} fill={gradient.start} />
      <Path d={`M${w + 1} 9 ${w + 11} 2V${t - 1}L${w + 1} ${b - 2}Z`} fill={`url(#${id}-pages)`} />
      <Path d={`M${w + 2} ${8 + t / 3} ${w + 10} ${2 + t / 3}M${w + 2} ${8 + t * 2 / 3} ${w + 10} ${2 + t * 2 / 3}`} stroke="#AA9D89" strokeOpacity={0.6} strokeWidth={0.6} />
      <Path d={`M0 8H${w}V${b}H0Z`} fill={`url(#${id}-cover)`} />
      <Path d={`M1 9H${w - 1}`} stroke="#FFFFFF" strokeOpacity={0.4} strokeWidth={0.7} />
      <Path d={`M0 ${b - 0.5}H${w}L${w + 12} ${t - 0.5}`} fill="none" stroke="#47314B" strokeOpacity={0.35} strokeWidth={1} />
      <Path d={`M8 9V${b - 1}M13 9V${b - 1}`} stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth={1} />
      <Path d={`M${w * 0.3} ${8 + t / 2}H${w * 0.7}`} stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={1.2} strokeLinecap="round" />
    </G>
  );
}

export function BookStack({ count }: BookStackProps) {
  const layers = bookStackLayers(count);

  return (
    <GlassSurface accessibilityLabel={`読んだ本 ${count}冊、再読を含む`} style={styles.card}>
      <View style={styles.summary}>
        <Text style={styles.count}>読んだ本</Text>
        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.total}><Text style={styles.countNum}>{count.toLocaleString('ja-JP')}</Text> 冊</Text>
        <Text style={styles.caption}>{count === 0 ? '最初の1冊を、ここから' : '再読も、あなたの積み重ねに'}</Text>
      </View>
      <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={styles.stack}>
        {layers > 0 && <View style={styles.groundShadow} />}
        {[2, 3, 0, 1].map((columnIndex) => (
          <View key={`book-column-${columnIndex}`} style={[
            styles.stackColumn,
            columnIndex >= 2 ? styles.rearColumn : styles.frontColumn,
            { left: columnIndex % 2 === 0 ? (columnIndex >= 2 ? '13%' : '0%') : (columnIndex >= 2 ? '49%' : '50%') },
          ]}>
            <Svg width="100%" height="100%" viewBox="0 0 160 300" preserveAspectRatio="xMidYMax meet">
              {bookTowerGeometry(count, columnIndex).map((book, index) => (
                <G key={index} transform={`translate(${book.left},${book.bottom - book.thickness - 8})`}>
                  <BookSvg id={`tower-${columnIndex}-${index}`} width={book.width} thickness={book.thickness} gradient={bookGradients[(columnIndex + index) % bookGradients.length]!} />
                </G>
              ))}
            </Svg>
          </View>
        ))}
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.48)',
    borderRadius: 0,
    overflow: 'hidden',
    padding: 18,
    position: 'relative',
  },
  summary: { alignItems: 'center', gap: 6 },
  total: { color: colors.text, fontSize: 20, fontWeight: '700', width: '100%', textAlign: 'center' },
  stack: { height: 300, marginTop: 12, borderBottomWidth: 2, borderBottomColor: colors.borderMuted },
  stackColumn: { position: 'absolute', width: '48%' },
  frontColumn: { height: 300, bottom: 0 },
  rearColumn: { height: 216, width: '35%', bottom: 30 },
  groundShadow: { position: 'absolute', bottom: -4, left: '4%', right: '4%', height: 18, borderRadius: 100, backgroundColor: 'rgba(58,42,65,0.13)', transform: [{ scaleY: 0.45 }] },
  count: { color: colors.text, fontSize: 20, fontWeight: '700' },
  countNum: { color: colors.navAccent, fontSize: 56, fontWeight: '800' },
  caption: { color: colors.textSecondary, fontSize: 13 },
});
