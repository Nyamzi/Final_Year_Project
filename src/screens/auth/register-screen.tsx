import { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { apiRegister } from "../../lib/api";
import { AppButton, AppInput } from "../../ui/controls";
import { theme } from "../../ui/theme";

type RegisterScreenProps = {
  onGoToLogin: () => void;
  onRegistered: () => void;
};

export function RegisterScreen({ onGoToLogin, onRegistered }: RegisterScreenProps) {
  const [fullName, setFullName] = useState("");
  const [nin, setNin] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [sex, setSex] = useState<"male" | "female" | "">("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const passwordStrength = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 2) return { label: "Weak", color: "#f59e0b" };
    if (score <= 4) return { label: "Medium", color: "#0f766e" };
    return { label: "Strong", color: "#16a34a" };
  }, [password]);

  async function handlePickProfileImage() {
    setError("");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Allow photo access to choose a profile picture.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.45,
      base64: true,
    });

    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      setError("Could not read the selected image. Try another picture.");
      return;
    }

    setProfileImageUrl(`data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`);
  }

  async function handleRegister() {
    setLoading(true);
    setError("");
    setMessage("");

    const fullNameValue = fullName.trim();
    const ninValue = nin.trim().toUpperCase();
    const phoneNumberValue = phoneNumber.replace(/[\s-]/g, "").trim();
    const emailValue = email.trim().toLowerCase();

    try {
      if (fullNameValue.length < 3) {
        setError("Full name must be at least 3 characters.");
        return;
      }
      if (!/^[A-Za-z0-9]{8,20}$/.test(ninValue)) {
        setError("NIN must be 8 to 20 letters or numbers.");
        return;
      }
      if (!/^\+?[0-9]{10,15}$/.test(phoneNumberValue)) {
        setError("Phone number must be 10 to 15 digits and may start with +.");
        return;
      }
      if (!/^\S+@\S+\.\S+$/.test(emailValue)) {
        setError("Enter a valid email address.");
        return;
      }
      if (!profileImageUrl) {
        setError("Choose a profile picture.");
        return;
      }
      if (!sex) {
        setError("Select male or female.");
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }

      await apiRegister({
        fullName: fullNameValue,
        nin: ninValue,
        phoneNumber: phoneNumberValue,
        email: emailValue,
        sex,
        profileImageUrl,
        password,
        confirmPassword,
      });
      setMessage("Account created. Check your email to verify your account before signing in.");
      onRegistered();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Fill in your details to get started</Text>

      <View style={styles.progressTrack}>
        <View style={styles.progressFill} />
      </View>
      <Text style={styles.stepText}>Step 1 of 1 - Personal Details</Text>

      <View style={styles.formWrap}>
        <AppInput label="Full Name" value={fullName} onChangeText={setFullName} placeholder="Enter your full name" />
        <AppInput label="National ID Number (NIN)" value={nin} onChangeText={setNin} placeholder="CM90003456789" autoCapitalize="characters" />
        <AppInput label="Phone Number" value={phoneNumber} onChangeText={setPhoneNumber} placeholder="+256700000000" keyboardType="phone-pad" />
        <AppInput label="Email Address" value={email} onChangeText={setEmail} placeholder="Enter your email" keyboardType="email-address" />

        <View style={styles.photoRow}>
          <View style={styles.photoPreview}>
            {profileImageUrl ? <Image source={{ uri: profileImageUrl }} style={styles.photoImage} resizeMode="cover" /> : <Text style={styles.photoInitial}>+</Text>}
          </View>
          <View style={styles.photoActions}>
            <Text style={styles.fieldLabel}>Profile Picture</Text>
            <AppButton title={profileImageUrl ? "Change Picture" : "Choose Picture"} variant="ghost" onPress={handlePickProfileImage} />
          </View>
        </View>

        <Text style={styles.fieldLabel}>Sex</Text>
        <View style={styles.sexRow}>
          <Pressable style={[styles.sexOption, sex === "male" && styles.sexOptionActive]} onPress={() => setSex("male")}>
            <Text style={[styles.sexOptionText, sex === "male" && styles.sexOptionTextActive]}>Male</Text>
          </Pressable>
          <Pressable style={[styles.sexOption, sex === "female" && styles.sexOptionActive]} onPress={() => setSex("female")}>
            <Text style={[styles.sexOptionText, sex === "female" && styles.sexOptionTextActive]}>Female</Text>
          </Pressable>
        </View>

        <AppInput label="Password" value={password} onChangeText={setPassword} placeholder="Create a strong password" secureTextEntry />
        <Text style={[styles.passwordStrength, { color: passwordStrength.color }]}>Password strength: {passwordStrength.label}</Text>
        <AppInput label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter your password" secureTextEntry />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {message ? <Text style={styles.successText}>{message}</Text> : null}

        <AppButton title={loading ? "Creating account..." : "Create Account"} loading={loading} onPress={handleRegister} />

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>Already have an account?</Text>
          <Pressable onPress={onGoToLogin}>
            <Text style={styles.linkText}>Sign In</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#e6e9fb",
    backgroundColor: theme.colors.panel,
    padding: 20,
    gap: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: theme.colors.text,
  },
  subtitle: {
    color: theme.colors.muted,
    marginTop: -2,
  },
  progressTrack: {
    marginTop: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#e6e9fb",
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    width: "35%",
    backgroundColor: theme.colors.primary,
  },
  stepText: {
    fontSize: 11,
    textAlign: "right",
    color: theme.colors.muted,
  },
  formWrap: {
    gap: 10,
    marginTop: 4,
  },
  photoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  photoPreview: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 1,
    borderColor: "#dbe3ff",
    backgroundColor: "#eef4ff",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photoImage: {
    width: 74,
    height: 74,
    borderRadius: 37,
  },
  photoInitial: {
    color: theme.colors.primary,
    fontSize: 30,
    fontWeight: "800",
  },
  photoActions: {
    flex: 1,
    gap: 6,
  },
  fieldLabel: {
    color: theme.colors.text,
    fontWeight: "700",
    fontSize: 13,
  },
  sexRow: {
    flexDirection: "row",
    gap: 10,
  },
  sexOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#dbe3ff",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  sexOptionActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  sexOptionText: {
    color: theme.colors.text,
    fontWeight: "700",
  },
  sexOptionTextActive: {
    color: "#ffffff",
  },
  passwordStrength: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: -4,
  },
  errorText: {
    color: theme.colors.danger,
    fontWeight: "600",
  },
  successText: {
    color: theme.colors.success,
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

