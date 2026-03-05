import { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Easing, Text, View } from "react-native";
import { AppLogo } from "@/components/app-logo";
import { colors } from "@/lib/theme";

export function LaunchScreen() {
  const pulse = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(pulse, {
        toValue: 1,
        duration: 3000,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(progress, {
        toValue: 1,
        duration: 3000,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false
      })
    ]).start();
  }, [progress, pulse]);

  const logoScale = pulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.92, 1.04, 1]
  });
  const logoOpacity = pulse.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0.4, 1, 1]
  });
  const barWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"]
  });

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.pageAccent,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24
      }}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 340,
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 28,
          backgroundColor: "#fff",
          paddingVertical: 34,
          paddingHorizontal: 18,
          gap: 14,
          shadowColor: "#0f172a",
          shadowOpacity: 0.08,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 3
        }}
      >
        <Animated.View style={{ transform: [{ scale: logoScale }], opacity: logoOpacity }}>
          <AppLogo />
        </Animated.View>
        <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", lineHeight: 19 }}>
          Find meaningful connections at your own pace.
        </Text>
        <View style={{ width: "82%", height: 6, borderRadius: 999, backgroundColor: "#f3f4f6", overflow: "hidden" }}>
          <Animated.View style={{ width: barWidth, height: "100%", backgroundColor: colors.primary, borderRadius: 999 }} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.muted, fontSize: 13, letterSpacing: 0.2 }}>Launching...</Text>
        </View>
      </View>
    </View>
  );
}
