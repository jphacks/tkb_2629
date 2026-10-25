import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

type GlassSurfaceProps = {
  accessibilityLabel?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  onPress?: () => void;
};

export function GlassSurface({ accessibilityLabel, children, intensity = 28, onPress, style }: GlassSurfaceProps) {
  const content = (
    <>
      <BlurView intensity={intensity} tint="light" style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={styles.highlight} />
      {children}
    </>
  );

  if (onPress) {
    return <Pressable accessibilityLabel={accessibilityLabel} onPress={onPress} style={[styles.surface, style]}>{content}</Pressable>;
  }

  return (
    <View accessibilityLabel={accessibilityLabel} style={[styles.surface, style]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    backgroundColor: 'rgba(255, 255, 255, 0.48)',
    borderColor: 'rgba(255, 255, 255, 0.82)',
    borderWidth: 1,
    overflow: 'hidden',
  },
  highlight: {
    borderColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 999,
    borderWidth: 1,
    height: 59,
    left: -20,
    opacity: 0.45,
    position: 'absolute',
    top: -58,
    width: '115%',
  },
});
