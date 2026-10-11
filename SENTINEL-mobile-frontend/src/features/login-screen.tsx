import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { radii, type Theme } from "../design/tokens";
import { Button } from "../ui";

const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";

export type MobileSession = {
  token: string;
  email: string;
  organizationName: string;
};

export function LoginScreen({
  colors,
  onSignedIn,
}: {
  colors: Theme;
  onSignedIn: (session: MobileSession) => void;
}) {
  const [mode, setMode] = useState<"sign-in" | "create">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(apiUrl + (mode === "sign-in" ? "/api/auth/login" : "/api/organizations"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          mode === "sign-in" ? { email, password } : { email, password, name, organization_name: organizationName },
        ),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(typeof body.detail === "string" ? body.detail : "Sign-in failed");
        return;
      }
      onSignedIn({
        token: body.token,
        email: body.user.email,
        organizationName: body.organization.name,
      });
    } catch {
      setError("Sign-in is unavailable");
    } finally {
      setPending(false);
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: colors.background }}>
      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>SENTINEL</Text>
      <Text accessibilityRole="header" style={{ color: colors.foreground, fontSize: 28, fontWeight: "600", marginTop: 8 }}>
        {mode === "sign-in" ? "Sign in" : "Create organization"}
      </Text>
      <Text style={{ color: colors.mutedForeground, marginTop: 8, marginBottom: 16 }}>
        The signed-in user belongs to one organization. That organization owns the Orbit webhook.
      </Text>
      {mode === "create" ? (
        <>
          <Field label="Organization" value={organizationName} onChange={setOrganizationName} colors={colors} />
          <Field label="Your name" value={name} onChange={setName} colors={colors} />
        </>
      ) : null}
      <Field label="Email" value={email} onChange={setEmail} colors={colors} />
      <Field label="Password" value={password} onChange={setPassword} colors={colors} secure />
      {error ? (
        <Text accessibilityRole="alert" style={{ color: colors.bad, marginBottom: 12 }}>
          {error}
        </Text>
      ) : null}
      <Button
        label={pending ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create and sign in"}
        variant="default"
        colors={colors}
        disabled={pending}
        onPress={() => {
          void submit();
        }}
      />
      <Button
        label={mode === "sign-in" ? "Create an organization" : "Have an account? Sign in"}
        colors={colors}
        onPress={() => {
          setMode(mode === "sign-in" ? "create" : "sign-in");
          setError("");
        }}
        style={{ marginTop: 8 }}
      />
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  colors,
  secure = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  colors: Theme;
  secure?: boolean;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 6 }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        autoCapitalize="none"
        style={{
          minHeight: 44,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radii.md,
          paddingHorizontal: 12,
          color: colors.foreground,
          backgroundColor: colors.card,
        }}
      />
    </View>
  );
}