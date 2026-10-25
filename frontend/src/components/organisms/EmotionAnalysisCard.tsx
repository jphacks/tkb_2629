import { colors } from "../../theme/colors";
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { StyleSheet, Text, View } from 'react-native';

import type { BookEmotions } from '../../lib/api';
import { GlassSurface } from '../atoms/GlassSurface';

type Emotion = {
  color: string;
  label: string;
  value: number;
};

const emotionDefinitions = [
  { label: '喜び', color: '#F9D949' },
  { label: '信頼', color: '#6BCB77' },
  { label: '恐れ', color: '#4DDBB5' },
  { label: '驚き', color: '#55A8E8' },
  { label: '悲しみ', color: '#6875D8' },
  { label: '嫌悪', color: '#9B6BD6' },
  { label: '怒り', color: '#F05D5E' },
  { label: '期待', color: '#F39A4A' },
];

const emotionNames = ['joy', 'trust', 'fear', 'surprise', 'sadness', 'disgust', 'anger', 'anticipation'];

const center = { x: 160, y: 132 };
const radius = 82;
const chartLevels = [0.25, 0.5, 0.75, 1];

export function EmotionAnalysisCard({ summary }: { summary: BookEmotions }) {
  const emotions = emotionDefinitions.map((emotion, index) => ({
    ...emotion,
    value: summary.emotion_scores[emotionNames[index]!] ?? 0,
  }));
  const totalBookmarks = summary.review_count;
  const total = emotions.reduce((sum, emotion) => sum + emotion.value, 0);
  const aggregatePoint = createAggregatePoint(emotions.map((emotion) => ({
    ...emotion, value: total > 0 ? emotion.value / total : 0,
  })));
  const aggregateColor = summary.color_code;

  return (
    <GlassSurface style={styles.card}>
      <Text style={styles.heading}>感情の分析</Text>
      <Text style={styles.description}>全{totalBookmarks}件のJEV解析済みしおりの平均</Text>
      <Text style={styles.description}>全ユーザー・全読書回の感情値を集計</Text>
      {totalBookmarks === 0 && <Text style={styles.description}>解析済みのしおりがないため、グレーで表示しています。</Text>}
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

function createAggregatePoint(emotions: Emotion[]) {
  return emotions.reduce((point, emotion, index) => {
    const axisPoint = getPoint(index, 1);
    return {
      x: point.x + (axisPoint.x - center.x) * emotion.value,
      y: point.y + (axisPoint.y - center.y) * emotion.value,
    };
  }, { x: center.x, y: center.y });
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
