import { useState } from "react";
import { Platform } from "react-native";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { apiLogin, apiLogout, setAuthToken, UserRole } from "../../lib/api";
import { AppButton, AppInput } from "../../ui/controls";
import { theme } from "../../ui/theme";

type LoginScreenProps = {
  onLoginSuccess: (session: { email: string; role: UserRole }) => void;
  onGoToRegister: () => void;
};

export function LoginScreen({ onLoginSuccess, onGoToRegister }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    setLoading(true);
    setError("");

    try {
      const data = await apiLogin({ email, password });

      if (data.role === "admin" && Platform.OS !== "web") {
        setAuthToken(null);
        try {
          await apiLogout();
        } catch {
          // If logout fails, we still block admin mobile access.
        }
        setError("Admin access is available on web only.");
        return;
      }

      setAuthToken(data.token ?? null);
      onLoginSuccess({ email, role: data.role });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sign in";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Image source={require("../../../assets/Logo/logo.jpg")} style={styles.logoImage} resizeMode="cover" />
      <Text style={styles.title}>Kids Banking</Text>
      <Text style={styles.subtitle}>Smart money habits start here</Text>

      <View style={styles.formWrap}>
        <Text style={styles.heading}>Welcome back!</Text>
        <Text style={styles.copy}>Sign in to continue</Text>

        <AppInput
          label="Email Address"
          value={email}
          placeholder="Enter your email"
          keyboardType="email-address"
          onChangeText={setEmail}
        />
        <AppInput
          label="Password"
          value={password}
          placeholder="Enter your password"
          secureTextEntry
          onChangeText={setPassword}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <AppButton title={loading ? "Signing in..." : "Sign In"} loading={loading} onPress={handleLogin} />

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>Don&apos;t have an account?</Text>
          <Pressable onPress={onGoToRegister}>
            <Text style={styles.linkText}>Sign Up</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#e6e9fb",
    backgroundColor: theme.colors.panel,
    padding: 20,
    gap: 12,
  },
  logoImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "#e6e9fb",
  },
  title: {
    textAlign: "center",
    fontSize: 28,
    fontWeight: "800",
    color: theme.colors.text,
  },
  subtitle: {
    textAlign: "center",
    fontSize: 14,
    color: theme.colors.muted,
    marginTop: -8,
  },
  formWrap: {
    marginTop: 8,
    gap: 12,
  },
  heading: {
    fontSize: 30,
    fontWeight: "800",
    color: theme.colors.text,
  },
  copy: {
    color: theme.colors.muted,
    marginTop: -4,
    marginBottom: 4,
  },
  errorText: {
    color: theme.colors.danger,
    fontWeight: "600",
  },
  metaRow: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  metaText: {
    color: theme.colors.muted,
  },
  linkText: {
    color: theme.colors.primary,
    fontWeight: "700",
  },
});
