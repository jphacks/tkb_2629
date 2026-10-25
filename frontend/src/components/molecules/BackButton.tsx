import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { colors } from '../../theme/colors';

type BackButtonProps = {
  onPress: () => void;
  disabled?: boolean;
};

export function BackButton({ onPress, disabled = false }: BackButtonProps) {
  return (
    <Pressable
      accessibilityLabel="前の画面に戻る"
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, (pressed || disabled) && styles.dimmed]}
    >
      <Ionicons color={colors.text} name="arrow-back" size={22} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.72)', borderColor: 'rgba(255, 255, 255, 0.9)', borderRadius: 22, borderWidth: 1, height: 44, width: 44 },
  dimmed: { opacity: 0.6 },
});
