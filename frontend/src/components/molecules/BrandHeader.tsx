import { Image, StyleSheet, View } from "react-native";

export function BrandHeader() {
  return (
    <View style={styles.brand}>
      <Image accessibilityLabel="Re:Readのロゴ" source={require('../../assets/brand-logo.png')} resizeMode="contain" style={styles.symbol} />
      <View style={styles.wordmark}>
        <Image accessibilityLabel="Re:Read" source={require('../../assets/brand-wordmark.png')} resizeMode="contain" style={styles.name} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: "center", flexDirection: "row", gap: 12 },
  symbol: {
    borderRadius: 10,
    height: 50,
    width: 50,
  },
  wordmark: { width: 32 * 960 / 220 },
  name: { height: 32, width: "100%" },
});
