import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';

type BookStackProps = {
  count: number;
};

const MAX_STACKED_BOOKS = 16;
const MAX_BACKGROUND_BOOKS = 24;

export function BookStack({ count }: BookStackProps) {
  const stackedBooks = Array.from({ length: Math.min(count, MAX_STACKED_BOOKS) });
  const backgroundBooks = Array.from({ length: Math.min(Math.max(0, count - MAX_STACKED_BOOKS), MAX_BACKGROUND_BOOKS) });
  const fallingValues = useRef<Animated.Value[]>([]).current;

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
    <View accessibilityLabel={`読んだ本 ${count}冊`} style={styles.card}>
      <View pointerEvents="none" style={styles.backgroundBooks}>
        {backgroundBooks.map((_, index) => (
          <Animated.Image
            accessibilityIgnoresInvertColors
            key={`background-book-${index}`}
            source={require('../../assets/book.png')}
            style={[
              styles.backgroundBook,
              {
                top: 40 + (index % 8) * 18,
                left: `${12 + (index % 3) * 30}%`,
                transform: [{ translateY: fallingValues[index]! }, { rotate: `${-10 + (index % 3) * 10}deg` }],
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.stackRow}>
        <View style={styles.stack}>
          {[0, 1].map((columnIndex) => (
            <View key={`book-column-${columnIndex}`} style={styles.stackColumn}>
              {stackedBooks.slice(columnIndex * 8, columnIndex * 8 + 8).map((_, index) => (
                <Image
                  accessibilityIgnoresInvertColors
                  accessibilityLabel="本"
                  key={`book-${columnIndex}-${index}`}
                  source={require('../../assets/book.png')}
                  style={[styles.book, { transform: [{ rotate: `${(index % 3) - 1}deg` }] }]}
                />
              ))}
            </View>
          ))}
        </View>
        <View style={{ flex: 1 ,alignItems: 'center', justifyContent: 'center' }} >
          <Text style={styles.count}>読んだ本:</Text>
          <Text style={styles.count}><Text style={styles.countNum}> {count}</Text>冊</Text>
        </View>
        

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F7FAF5',
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
  count: { color: '#64A56D', fontSize: 30, fontWeight: '800'},
  countNum: { color: '#64A56D', fontSize: 80, fontWeight: '800'},
  backgroundBooks: { ...StyleSheet.absoluteFill, opacity: 0.45 },
  backgroundBook: { height: 38, position: 'absolute', width: 100 },
});
