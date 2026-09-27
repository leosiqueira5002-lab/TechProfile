import { AuthForm } from "@/components/auth-form";

export const metadata = {
  title: "Entrar — TechProfile AI",
  description: "Acesse seu espaço profissional no TechProfile AI.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ auth?: string }> }) {
  const { auth } = await searchParams;
  const initialMessage = auth === "confirmation"
    ? "Não foi possível confirmar o e-mail. Solicite um novo link ou tente entrar novamente."
    : undefined;

  return <AuthForm mode="login" initialMessage={initialMessage} />;
}
