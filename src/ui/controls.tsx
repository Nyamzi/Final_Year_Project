import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { theme } from "./theme";

type AppInputProps = {
  label: string;
  value: string;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address" | "phone-pad" | "numeric";
  multiline?: boolean;
  numberOfLines?: number;
  onChangeText: (value: string) => void;
};

export function AppInput({
  label,
  value,
  placeholder,
  secureTextEntry,
  autoCapitalize = "none",
  keyboardType = "default",
  multiline = false,
  numberOfLines = 1,
  onChangeText,
}: AppInputProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.muted}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={numberOfLines}
        style={[styles.input, multiline ? styles.inputMultiline : null]}
      />
    </View>
  );
}

type AppDateInputProps = {
  label: string;
  value: string;
  placeholder?: string;
  onChangeText: (value: string) => void;
};

const webDateInputStyle = {
  border: `1px solid ${theme.colors.border}`,
  backgroundColor: "#fff",
  borderRadius: 12,
  height: 48,
  padding: "0 14px",
  color: theme.colors.text,
  fontSize: 15,
  width: "100%",
  boxSizing: "border-box",
} as const;

export function AppDateInput({ label, value, placeholder = "YYYY-MM-DD", onChangeText }: AppDateInputProps) {
  if (Platform.OS === "web") {
    return (
      <View style={styles.fieldWrap}>
        <Text style={styles.label}>{label}</Text>
        {/* Web gets a native calendar picker via input[type=date] */}
        <input
          type="date"
          value={value}
          onChange={(event) => onChangeText(event.target.value)}
          placeholder={placeholder}
          style={webDateInputStyle}
        />
      </View>
    );
  }

  return (
    <AppInput
      label={label}
      value={value}
      placeholder={placeholder}
      onChangeText={onChangeText}
    />
  );
}

type AppTimeInputProps = {
  label: string;
  value: string;
  placeholder?: string;
  onChangeText: (value: string) => void;
};

export function AppTimeInput({ label, value, placeholder = "HH:MM", onChangeText }: AppTimeInputProps) {
  if (Platform.OS === "web") {
    return (
      <View style={styles.fieldWrap}>
        <Text style={styles.label}>{label}</Text>
        <input
          type="time"
          value={value}
          onChange={(event) => onChangeText(event.target.value)}
          placeholder={placeholder}
          style={webDateInputStyle}
        />
      </View>
    );
  }

  return (
    <AppInput
      label={label}
      value={value}
      placeholder={placeholder}
      onChangeText={onChangeText}
    />
  );
}

type AppButtonProps = {
  title: string;
  loading?: boolean;
  variant?: "primary" | "ghost";
  onPress: () => void;
};

export function AppButton({ title, loading, variant = "primary", onPress }: AppButtonProps) {
  const isGhost = variant === "ghost";
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        styles.button,
        isGhost ? styles.buttonGhost : styles.buttonPrimary,
        pressed && !loading ? styles.buttonPressed : null,
        loading ? styles.buttonDisabled : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isGhost ? theme.colors.text : "#ffffff"} />
      ) : (
        <Text style={isGhost ? styles.buttonGhostText : styles.buttonPrimaryText}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fieldWrap: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "#fff",
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    color: theme.colors.text,
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 88,
    height: "auto",
    textAlignVertical: "top",
    paddingTop: 12,
    paddingBottom: 12,
  },
  button: {
    minHeight: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  buttonPrimary: {
    backgroundColor: theme.colors.primary,
  },
  buttonGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonPrimaryText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
  buttonGhostText: {
    color: theme.colors.text,
    fontWeight: "700",
    fontSize: 15,
  },
});

