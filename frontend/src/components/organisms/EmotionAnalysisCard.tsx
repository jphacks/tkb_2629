import { colors } from "../../theme/colors";
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { StyleSheet, Text, View } from 'react-native';

import type { Bookmark } from '../../types/bookmark';
import { GlassSurface } from '../atoms/GlassSurface';

type Emotion = {
  color: string;
  label: string;
  value: number;
};

const emotionDefinitions = [
  { label: '喜び', color: '#F9D949', keywords: ['お気に入り', '面白い', '星空', '出会'] },
  { label: '信頼', color: '#6BCB77', keywords: ['共感', '同じ空', '旅'] },
  { label: '恐れ', color: '#4DDBB5', keywords: ['決断', '直前'] },
  { label: '驚き', color: '#55A8E8', keywords: ['初めて', '一気', '出会'] },
  { label: '悲しみ', color: '#6875D8', keywords: ['遠くても', '悲し'] },
  { label: '嫌悪', color: '#9B6BD6', keywords: ['嫌', '苦'] },
  { label: '怒り', color: '#F05D5E', keywords: ['怒', '許せ'] },
  { label: '期待', color: '#F39A4A', keywords: ['次に読む', 'ここから', '旅に出', '動き出'] },
];

const center = { x: 160, y: 132 };
const radius = 82;
const chartLevels = [0.25, 0.5, 0.75, 1];

export function EmotionAnalysisCard({ bookmarks }: { bookmarks: Bookmark[] }) {
  const emotions = createEmotionSummary(bookmarks);
  const totalBookmarks = bookmarks.reduce((sum, bookmark) => sum + Math.max(1, bookmark.count), 0);
  const aggregatePoint = createAggregatePoint(emotions);
  const aggregateColor = createAggregateColor(emotions);

  return (
    <GlassSurface style={styles.card}>
      <Text style={styles.heading}>感情の分析</Text>
      <Text style={styles.description}>全{totalBookmarks}件のしおりをまとめて分析</Text>
      <Text style={styles.description}>各感情の割合から全体の位置を計算</Text>
      <Svg height={280} viewBox="0 0 320 280" width="100%">
        {chartLevels.map((level) => (
          <Polygon key={level} fill="none" points={createPolygonPoints(emotions, level)} stroke="#E9E7F0" strokeWidth="1" />
        ))}
        {emotions.map((emotion, index) => {
          const point = getPoint(index, 1);
          return <Line key={emotion.label} stroke="#E9E7F0" strokeWidth="1" x1={center.x} x2={point.x} y1={center.y} y2={point.y} />;
        })}
        <Circle cx={aggregatePoint.x} cy={aggregatePoint.y} fill={aggregateColor} r="8" stroke={colors.background} strokeWidth="3" />
        {emotions.map((emotion, index) => {
          const labelPoint = getPoint(index, 1.22);
          return <SvgText key={emotion.label} fill={emotion.color} fontSize="12" fontWeight="600" textAnchor="middle" x={labelPoint.x} y={labelPoint.y}>{emotion.label}</SvgText>;
        })}
      </Svg>
      <View style={styles.legend}>
        {emotions.map((emotion) => (
          <View key={emotion.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: emotion.color }]} />
            <Text style={styles.legendLabel}>{emotion.label}</Text>
            <Text style={styles.legendValue}>{Math.round(emotion.value * 100)}%</Text>
          </View>
        ))}
      </View>
    </GlassSurface>
  );
}

export function getAggregateEmotionColor(bookmarks: Bookmark[]) {
  return createAggregateColor(createEmotionSummary(bookmarks));
}

export function getEmotionTint(color: string) {
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * 0.88).toString(16).padStart(2, '0');
  return `#${mix(red)}${mix(green)}${mix(blue)}`;
}

function getPoint(index: number, scale: number) {
  const angle = -Math.PI / 2 + (index * Math.PI) / 4;
  return {
    x: center.x + Math.cos(angle) * radius * scale,
    y: center.y + Math.sin(angle) * radius * scale,
  };
}

function createPolygonPoints(emotions: Emotion[], scale: number) {
  return emotions.map((_, index) => {
    const point = getPoint(index, scale);
    return `${point.x},${point.y}`;
  }).join(' ');
}

function createEmotionSummary(bookmarks: Bookmark[]): Emotion[] {
  const scores = emotionDefinitions.map((emotion) => bookmarks.reduce((total, bookmark) => {
    const text = `${bookmark.title}${bookmark.note}`;
    const matchesKeyword = emotion.keywords.some((keyword) => text.includes(keyword));
    const weight = Math.max(1, bookmark.count);
    return total + weight * (matchesKeyword ? 1 : 0.12);
  }, 0));
  const totalScore = scores.reduce((sum, score) => sum + score, 0) || 1;

  return emotionDefinitions.map((emotion, index) => ({
    color: emotion.color,
    label: emotion.label,
    value: (scores[index] ?? 0) / totalScore,
  }));
}

function createAggregatePoint(emotions: Emotion[]) {
  return emotions.reduce((point, emotion, index) => {
    const axisPoint = getPoint(index, 1);
    return {
      x: point.x + (axisPoint.x - center.x) * emotion.value,
      y: point.y + (axisPoint.y - center.y) * emotion.value,
    };
  }, { x: center.x, y: center.y });
}

function createAggregateColor(emotions: Emotion[]) {
  const colors = emotions.map((emotion) => hexToHsl(emotion.color));
  const hueVector = colors.reduce((vector, color, index) => {
    const weight = emotions[index]?.value ?? 0;
    const radians = (color.hue * Math.PI) / 180;
    return {
      x: vector.x + Math.cos(radians) * weight,
      y: vector.y + Math.sin(radians) * weight,
    };
  }, { x: 0, y: 0 });
  const hue = (Math.atan2(hueVector.y, hueVector.x) * 180) / Math.PI;
  const normalizedHue = hue < 0 ? hue + 360 : hue;
  const saturation = colors.reduce((sum, color, index) => sum + color.saturation * (emotions[index]?.value ?? 0), 0);
  const lightness = colors.reduce((sum, color, index) => sum + color.lightness * (emotions[index]?.value ?? 0), 0);

  return hslToHex(normalizedHue, saturation, lightness);
}

function hexToHsl(hex: string) {
  const red = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const green = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }

  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return { hue: hue < 0 ? hue + 360 : hue, lightness, saturation };
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = lightness - chroma / 2;
  const [red, green, blue] = hue < 60 ? [chroma, x, 0] : hue < 120 ? [x, chroma, 0] : hue < 180 ? [0, chroma, x] : hue < 240 ? [0, x, chroma] : hue < 300 ? [x, 0, chroma] : [chroma, 0, x];
  return `#${[red, green, blue].map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, '0')).join('')}`;
}

const styles = StyleSheet.create({
  card: { backgroundColor: 'rgba(255, 255, 255, 0.48)', borderRadius: 16, elevation: 2, marginTop: 16, padding: 18, shadowColor: colors.black, shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { height: 1, width: 0 } },
  heading: { color: colors.text, fontSize: 16, fontWeight: '700' },
  description: { color: colors.placeholder, fontSize: 12, marginTop: 5 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: -4 },
  legendItem: { alignItems: 'center', flexDirection: 'row', minWidth: '45%' },
  legendDot: { borderRadius: 5, height: 10, marginRight: 6, width: 10 },
  legendLabel: { color: '#666666', fontSize: 12 },
  legendValue: { color: '#A1A1AA', fontSize: 11, marginLeft: 'auto' },
});
