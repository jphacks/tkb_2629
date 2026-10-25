import { colors } from "../../theme/colors";
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { GlassSurface } from '../atoms/GlassSurface';

type BookStackProps = {
  count: number;
};

const MAX_STACKED_BOOKS = 16;
const MAX_BACKGROUND_BOOKS = 24;
const bookGradients = [
  { end: '#DFA9F0', start: '#c07aef' },
  { end: '#AFC9F5', start: '#709deb' },
  { end: '#F2AAC6', start: '#e66e9c' },
  { end: '#F4D78A', start: '#d3a954' },
  { end: '#A4D9B9', start: '#58be8d' },
  { end: '#F1B08D', start: '#D87544' },
];

function BookSvg({ gradient }: { gradient: { end: string; start: string } }) {
  return (
    <Svg height="100%" viewBox="0 0 454 170" width="100%">
      <Defs>
        <LinearGradient gradientUnits="userSpaceOnUse" id="bookGradient" x1="227" x2="227" y1="0" y2="170">
          <Stop offset="0" stopColor={gradient.start} />
          <Stop offset="1" stopColor={gradient.end} />
        </LinearGradient>
      </Defs>
      <Path d="M443 0.041C449.16 0.549 454 5.709 454 12c0 6.291-4.841 11.45-11 11.958V24H401.501v122H443v.041c6.16.508 11 5.668 11 11.959 0 6.291-4.841 11.45-11 11.958V170H30c-16.569 0-30-13.431-30-30V30C0 13.431 13.431 0 30 0h413v.041Z" fill="url(#bookGradient)" />
      <Rect fill="#D9D9D9" height="121" rx="20" width="400" x="43" y="24" />
      <Path d="M43 40.5h400M43 54.5h400M43 68.5h400M43 82.5h400M43 96.5h400M43 110.5h400M43 124.5h400" stroke={colors.borderMuted} strokeWidth="5" />
      <Circle cx="442" cy="12" fill="url(#bookGradient)" r="12" />
      <Circle cx="442" cy="158" fill="url(#bookGradient)" r="12" />
    </Svg>
  );
}

export function BookStack({ count }: BookStackProps) {
  const stackedBooks = Array.from({ length: Math.min(count, MAX_STACKED_BOOKS) });
  const backgroundBooks = Array.from({ length: Math.min(Math.max(0, count - MAX_STACKED_BOOKS), MAX_BACKGROUND_BOOKS) });
  const fallingValues = useRef<Animated.Value[]>([]).current;
  const randomGradients = Array.from(
    { length: stackedBooks.length + backgroundBooks.length },
    () => bookGradients[Math.floor(Math.random() * bookGradients.length)]!,
  );

  while (fallingValues.length < backgroundBooks.length) {
    fallingValues.push(new Animated.Value(0));
  }

  useEffect(() => {
    backgroundBooks.forEach((_, index) => {
      const initialTop = 40 + (index % 8) * 18;
      const bottom = 8 + Math.floor(index / 3) * 20;
      const fallDistance = Math.max(0, 400 - bottom - 38 - initialTop);

      Animated.spring(fallingValues[index]!, {
        damping: 12,
        mass: 0.8,
        stiffness: 90,
        toValue: fallDistance,
        useNativeDriver: true,
      }).start();
    });
  }, [backgroundBooks.length, fallingValues]);

  return (
    <GlassSurface accessibilityLabel={`読んだ本 ${count}冊`} style={styles.card}>
      <View pointerEvents="none" style={styles.backgroundBooks}>
        {backgroundBooks.map((_, index) => (
          <Animated.View
            key={`background-book-${index}`}
            style={[
              styles.backgroundBook,
              {
                top: 40 + (index % 8) * 18,
                left: `${12 + (index % 3) * 30}%`,
                transform: [{ translateY: fallingValues[index]! }, { rotate: `${-10 + (index % 3) * 10}deg` }],
              },
            ]}
          >
            <BookSvg gradient={randomGradients[index]!} />
          </Animated.View>
        ))}
      </View>
      <View style={styles.stackRow}>
        <View style={styles.stack}>
          {[0, 1].map((columnIndex) => (
            <View key={`book-column-${columnIndex}`} style={styles.stackColumn}>
              {stackedBooks.slice(columnIndex * 8, columnIndex * 8 + 8).map((_, index) => (
                <View
                  accessibilityLabel="本"
                  key={`book-${columnIndex}-${index}`}
                  style={[styles.book, { transform: [{ rotate: `${(index % 3) - 1}deg` }] }]}
                >
                  <BookSvg gradient={randomGradients[backgroundBooks.length + columnIndex * 8 + index]!} />
                </View>
              ))}
            </View>
          ))}
        </View>
        <View style={{ flex: 1 ,alignItems: 'center', justifyContent: 'center' }} >
          <Text style={styles.count}>読んだ本:</Text>
          <Text style={styles.count}><Text style={styles.countNum}> {count}</Text>冊</Text>
        </View>


      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.48)',
    borderRadius: 0,
    height: 400,
    overflow: 'hidden',
    padding: 18,
    position: 'relative',
  },
  stackRow: { alignItems: 'center', flex: 1, flexDirection: 'row' },
  stack: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', marginLeft: 10, marginTop: 12 },
  stackColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  book: { height: 38, margin: 4, width: 100 },
  count: { color: colors.text, fontSize: 30, fontWeight: '800'},
  countNum: { color: colors.navAccent, fontSize: 80, fontWeight: '800'},
  backgroundBooks: { ...StyleSheet.absoluteFill, opacity: 0.45 },
  backgroundBook: { height: 38, position: 'absolute', width: 100 },
});
