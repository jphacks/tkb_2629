import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { GlassSurface } from './GlassSurface';

import { colors } from '../../theme/colors';

export function ShadowInput(props: TextInputProps) {
  return (
    <GlassSurface style={styles.surface} intensity={22}>
      <TextInput placeholderTextColor={colors.placeholder} {...props} style={[styles.input, props.style]} />
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  surface: {
    borderRadius: 12,
  },
  input: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    fontSize: 16,
    paddingHorizontal: 16,
  },
});
