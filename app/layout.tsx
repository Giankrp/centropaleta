import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Centro Paleta",
  description: "Tienda de coleccionables TCG de Centro Paleta.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
