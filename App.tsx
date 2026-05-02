import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Platform, SafeAreaView, ScrollView, StyleSheet, Text } from "react-native";
import { apiLogout, apiMe, setAuthToken, UserRole } from "./src/lib/api";
import { LoginScreen } from "./src/screens/auth/login-screen";
import { RegisterScreen } from "./src/screens/auth/register-screen";
import { DashboardShell } from "./src/screens/dashboard/dashboard-shell";
import { theme } from "./src/ui/theme";

type AppView = "login" | "register" | "dashboard";

type Session = {
  email: string;
  role: UserRole;
  fullName: string | null;
  phoneNumber: string | null;
  nin: string | null;
  profileImageUrl: string | null;
};

export default function App() {
  const [view, setView] = useState<AppView>("login");
  const [loadingSession, setLoadingSession] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      try {
        const data = await apiMe();
        if (!mounted) return;
        if (data.user.role === "admin" && Platform.OS !== "web") {
          try {
            await apiLogout();
          } catch {
            // Clear local session even if network logout fails.
          }
          setAuthToken(null);
          setSession(null);
          setView("login");
          return;
        }
        setSession({ email: data.user.email, role: data.user.role, fullName: data.user.fullName, phoneNumber: data.user.phoneNumber, nin: data.user.nin, profileImageUrl: data.user.profileImageUrl });
        setView("dashboard");
      } catch {
        if (!mounted) return;
        setSession(null);
        setView("login");
      } finally {
        if (mounted) setLoadingSession(false);
      }
    }

    restoreSession();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleLogout() {
    try {
      await apiLogout();
    } catch {
      // Ignore logout network errors and clear local session anyway.
    }
    setAuthToken(null);
    setSession(null);
    setView("login");
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      {!loadingSession && view === "dashboard" && session ? (
        <DashboardShell email={session.email} role={session.role} fullName={session.fullName} phoneNumber={session.phoneNumber} nin={session.nin} profileImageUrl={session.profileImageUrl} onLogout={handleLogout} />
      ) : (
        <ScrollView contentContainerStyle={styles.container}>
          {loadingSession ? <Text style={styles.loadingText}>Loading session...</Text> : null}

          {!loadingSession && view === "login" ? (
            <LoginScreen
              onGoToRegister={() => setView("register")}
              onLoginSuccess={(next) => {
                setSession(next);
                setView("dashboard");
              }}
            />
          ) : null}

          {!loadingSession && view === "register" ? (
            <RegisterScreen
              onGoToLogin={() => setView("login")}
              onRegistered={() => setView("login")}
            />
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  container: {
    flexGrow: 1,
    padding: 16,
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    width: "100%",
    maxWidth: 980,
    alignSelf: "center",
    color: theme.colors.muted,
    fontWeight: "600",
  },
});

