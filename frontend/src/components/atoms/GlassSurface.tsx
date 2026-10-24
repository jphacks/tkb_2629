import { BlurView } from 'expo-blur';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

type GlassSurfaceProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
};

export function GlassSurface({ children, intensity = 28, style }: GlassSurfaceProps) {
  return (
    <View style={[styles.surface, style]}>
      <BlurView intensity={intensity} tint="light" style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={styles.highlight} />
      {children}
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
