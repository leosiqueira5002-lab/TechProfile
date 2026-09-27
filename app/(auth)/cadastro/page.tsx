import { AuthForm } from "@/components/auth-form";

export const metadata = {
  title: "Criar conta — TechProfile AI",
  description: "Crie sua conta no TechProfile AI.",
};

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
