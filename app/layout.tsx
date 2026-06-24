import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Production Line Live',
  description: 'Simulación de línea de producción con LEGO',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
