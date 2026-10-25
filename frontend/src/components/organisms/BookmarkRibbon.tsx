import { Animated, StyleSheet, View } from 'react-native';

type BookmarkRibbonProps = {
  translateY?: Animated.Value;
  color?: string;
};

export function BookmarkRibbon({ translateY, color }: BookmarkRibbonProps) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.ribbon, translateY && { transform: [{ translateY }] }]}
    >
      <View style={[styles.arm, styles.left, color ? { backgroundColor: color } : undefined]} />
      <View style={[styles.arm, styles.right, color ? { backgroundColor: color } : undefined]} />
      <View style={[styles.center, color ? { backgroundColor: color } : undefined]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ribbon: {
    height: 102,
    left: '50%',
    marginLeft: -55.5,
    position: 'absolute',
    top: 36,
    width: 111,
    zIndex: 2,
  },
  arm: { backgroundColor: '#8B5CF6', borderRadius: 8, height: 76, position: 'absolute', top: 2, width: 30 },
  left: { left: 23, transform: [{ rotate: '-31deg' }] },
  right: { right: 23, transform: [{ rotate: '31deg' }] },
  center: { backgroundColor: '#7C3AED', borderRadius: 20, bottom: 0, height: 40, left: 36, position: 'absolute', width: 40 },
});
