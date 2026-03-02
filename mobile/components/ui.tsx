import { ComponentProps, PropsWithChildren } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "@/lib/theme";

export function Screen({ children }: PropsWithChildren) {
  return <View style={styles.screen}>{children}</View>;
}

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export function Heading({ children }: PropsWithChildren) {
  return <Text style={styles.heading}>{children}</Text>;
}

export function Body({ children }: PropsWithChildren) {
  return <Text style={styles.body}>{children}</Text>;
}

export function Input(props: ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor={colors.muted} style={styles.input} {...props} />;
}

export function Button({
  label,
  onPress,
  disabled,
  secondary
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, secondary ? styles.buttonSecondary : styles.buttonPrimary, disabled && styles.buttonDisabled]}
    >
      <Text style={[styles.buttonText, secondary && styles.buttonSecondaryText]}>{label}</Text>
    </Pressable>
  );
}

export function InlineStatus({
  text,
  tone
}: {
  text: string;
  tone: "danger" | "success" | "default";
}) {
  return <Text style={[styles.status, tone === "danger" && styles.statusDanger, tone === "success" && styles.statusSuccess]}>{text}</Text>;
}

export function Busy({ label = "Loading..." }: { label?: string }) {
  return (
    <View style={styles.busyWrap}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.body}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.page,
    padding: 16,
    gap: 12
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8
  },
  heading: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700"
  },
  body: {
    color: colors.muted,
    fontSize: 14
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: "#fff"
  },
  button: {
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center"
  },
  buttonPrimary: {
    backgroundColor: colors.primary
  },
  buttonSecondary: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border
  },
  buttonDisabled: {
    opacity: 0.7
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700"
  },
  buttonSecondaryText: {
    color: colors.text
  },
  status: {
    fontSize: 13,
    color: colors.muted
  },
  statusDanger: {
    color: colors.danger
  },
  statusSuccess: {
    color: colors.success
  },
  busyWrap: {
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24
  }
});
