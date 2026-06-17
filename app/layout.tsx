import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Production Line Live",
  description: "Juego físico con LEGO y digitalización en vivo de la línea de producción.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
