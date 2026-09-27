import type { AuthMode } from "./validation.ts";

export function getFriendlyAuthError(code: string | undefined, mode: AuthMode): string {
  switch (code) {
    case "invalid_email":
    case "email_address_invalid":
      return "Digite um e-mail válido.";
    case "email_not_confirmed":
      return "Confirme seu e-mail antes de entrar.";
    case "email_exists":
    case "user_already_exists":
      return "Já existe uma conta com este e-mail. Entre ou use outro endereço.";
    case "weak_password":
    case "password_too_short":
      return "A senha não atende aos requisitos configurados. Escolha outra senha.";
    case "invalid_credentials":
      return "E-mail ou senha incorretos.";
    case "fetch_error":
    case "request_timeout":
    case "unexpected_failure":
      return getFriendlyConnectionError();
    case "over_email_send_rate_limit":
      return "Muitas solicitações de e-mail foram feitas. Aguarde alguns minutos e tente novamente.";
    default:
      return mode === "signup"
        ? "Não foi possível criar a conta agora. Confira os dados e tente novamente."
        : "Não foi possível entrar agora. Confira os dados e tente novamente.";
  }
}

export function getFriendlyConnectionError(): string {
  return "Não foi possível conectar ao serviço de autenticação. Verifique sua conexão e tente novamente.";
}
