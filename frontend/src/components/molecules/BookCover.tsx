import { StyleSheet, Text, View } from 'react-native';

type BookCoverProps = { title?: string; author?: string; color?: string; compact?: boolean; large?: boolean; grid?: boolean };

export function BookCover({ title = '本のタイトル', author = '著者名', color, compact = false, large = false, grid = false }: BookCoverProps) {
  const coverColor = color ?? '#E7B7F2';
  const sunColor = adjustLightness(coverColor, 0.18);
  const waveColor = adjustLightness(coverColor, -0.12);

  return (
    <View style={[styles.cover, { backgroundColor: coverColor }, compact && styles.compact, large && styles.large, grid && styles.grid]}>
      <Text style={[styles.coverTitle, compact && styles.compactTitle]}>{title}</Text>
      <Text style={[styles.author, compact && styles.compactAuthor]}>{author}</Text>
      <View style={[styles.sun, { backgroundColor: sunColor }]} />
      <View style={[styles.wave, { backgroundColor: waveColor }]} />
      <Text style={styles.publisher}>出版社</Text>
    </View>
  );
}

function adjustLightness(hex: string, amount: number) {
  const value = hex.replace('#', '');
  if (value.length !== 6) return hex;

  const red = Number.parseInt(value.slice(0, 2), 16) / 255;
  const green = Number.parseInt(value.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    const channel = Math.round(Math.max(0, Math.min(1, lightness + amount)) * 255).toString(16).padStart(2, '0');
    return `#${channel}${channel}${channel}`;
  }

  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue: number;

  if (max === red) hue = ((green - blue) / delta + (green < blue ? 6 : 0)) / 6;
  else if (max === green) hue = ((blue - red) / delta + 2) / 6;
  else hue = ((red - green) / delta + 4) / 6;

  const nextLightness = Math.max(0, Math.min(1, lightness + amount));
  const channel = (value: number) => {
    const hueToRgb = (t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return 6 * t;
      if (t < 1 / 2) return 1;
      if (t < 2 / 3) return (2 / 3 - t) * 6;
      return 0;
    };

    const q = nextLightness < 0.5 ? nextLightness * (1 + saturation) : nextLightness + saturation - nextLightness * saturation;
    const p = 2 * nextLightness - q;
    return Math.round((p + (q - p) * hueToRgb(value)) * 255).toString(16).padStart(2, '0');
  };

  return `#${channel(hue + 1 / 3)}${channel(hue)}${channel(hue - 1 / 3)}`;
}

const styles = StyleSheet.create({
  cover: { backgroundColor: '#E7B7F2', borderRadius: 4, height: 95, overflow: 'hidden', width: 66 },
  compact: { height: 72, width: 50 },
  large: { height: 140, width: 94 },
  grid: { height: 140, width: 94 },
  coverTitle: { color: '#5D3B6F', fontSize: 9, fontWeight: '700', margin: 8 },
  compactTitle: { fontSize: 7, margin: 6 },
  author: { color: '#6E4F7D', fontSize: 6, marginHorizontal: 8 },
  compactAuthor: { fontSize: 5, marginHorizontal: 6 },
  sun: { backgroundColor: '#F8DC84', borderRadius: 30, height: 30, position: 'absolute', right: 8, top: 42, width: 30 },
  wave: { backgroundColor: '#F39BA7', borderRadius: 60, bottom: -35, height: 80, left: -20, position: 'absolute', width: 130 },
  publisher: { bottom: 8, color: '#6E4F7D', fontSize: 6, position: 'absolute', right: 8 },
});
