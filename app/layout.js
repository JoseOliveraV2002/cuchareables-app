import "./globals.css";

export const metadata = {
  title: "Gestión de cucharables",
  description: "Clientes, compras, recetas y ventas",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
