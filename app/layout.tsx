import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TechProfile AI — Seu currículo deveria trabalhar por você",
  description:
    "Prepare uma apresentação profissional mais clara e alinhada ao seu próximo passo, sempre fiel à sua experiência.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
