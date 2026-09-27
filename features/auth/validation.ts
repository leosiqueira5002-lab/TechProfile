export type AuthMode = "login" | "signup";

export function validateAuthInput(
  mode: AuthMode,
  email: string,
  password: string,
  confirmPassword = "",
): string | null {
  const normalizedEmail = email.trim();

  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return "Digite um e-mail válido.";
  }

  if (!password) return "Digite sua senha.";

  if (mode === "signup" && password !== confirmPassword) {
    return "As senhas não coincidem.";
  }

  return null;
}
