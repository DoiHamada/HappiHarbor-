import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Body, Button, Card, Heading, InlineStatus, Input, Screen } from "@/components/ui";

type Mode = "sign_in" | "sign_up" | "forgot";

export default function SignInScreen() {
  const [mode, setMode] = useState<Mode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ text: string; tone: "danger" | "success" | "default" } | null>(null);

  async function submit() {
    setLoading(true);
    setStatus(null);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setStatus({ text: "Password reset link sent.", tone: "success" });
        return;
      }

      if (mode === "sign_up") {
        if (password !== confirmPassword) {
          setStatus({ text: "Passwords do not match.", tone: "danger" });
          return;
        }
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setStatus({ text: "Account created. Check email to verify.", tone: "success" });
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace("/");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed.";
      setStatus({ text: message, tone: "danger" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.select({ ios: "padding", default: undefined })}>
        <Card>
          <Heading>Welcome to HappiHarbor</Heading>
          <Body>Sign in, create account, or recover password.</Body>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button label="Log in" onPress={() => setMode("sign_in")} secondary={mode !== "sign_in"} />
            <Button label="Join" onPress={() => setMode("sign_up")} secondary={mode !== "sign_up"} />
          </View>

          <Input placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          {mode !== "forgot" ? (
            <Input placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
          ) : null}
          {mode === "sign_up" ? (
            <Input
              placeholder="Confirm password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          ) : null}

          <Button
            label={loading ? "Please wait..." : mode === "sign_up" ? "Create account" : mode === "forgot" ? "Send reset" : "Log in"}
            onPress={submit}
            disabled={loading || !email || (mode !== "forgot" && !password)}
          />

          <Text onPress={() => setMode(mode === "forgot" ? "sign_in" : "forgot")} style={{ textDecorationLine: "underline" }}>
            {mode === "forgot" ? "Back to log in" : "Forgot password?"}
          </Text>

          {status ? <InlineStatus text={status.text} tone={status.tone} /> : null}
        </Card>
      </KeyboardAvoidingView>
    </Screen>
  );
}
