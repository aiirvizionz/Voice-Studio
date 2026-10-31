import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Voice Studio | Diseño de voces con IA",
  description: "Diseña voces originales con Prompt-to-Voice y pruébalas en GPT-Live.",
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="es"><body>{children}</body></html>;
}
