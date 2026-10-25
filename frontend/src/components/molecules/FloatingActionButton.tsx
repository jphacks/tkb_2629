import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../theme/colors';

type FloatingActionButtonProps = {
  onPress: () => void;
};

export function FloatingActionButton({ onPress }: FloatingActionButtonProps) {
  return (
    <Pressable
      accessibilityLabel="しおりを追加"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons color={colors.background} name="bookmark" size={24} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 113, 113, 0.86)',
    borderColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderRadius: 30,
    bottom: 32,
    elevation: 6,
    height: 58,
    justifyContent: 'center',
    position: 'absolute',
    right: 24,
    shadowColor: '#B66E87',
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    width: 58,
    zIndex: 5,
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.94 }] },
});
