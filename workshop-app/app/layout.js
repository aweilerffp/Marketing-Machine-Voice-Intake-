import "./globals.css";

export const metadata = {
  title: "Brand Builder Workshop",
  description: "Voice-powered brand discovery session",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
