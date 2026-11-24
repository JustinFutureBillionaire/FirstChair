import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/instrument-serif/latin-400.css";
import "@fontsource/instrument-serif/latin-400-italic.css";
import "./globals.css";

export const metadata = {
  title: "First Chair | Opportunity desk",
  description: "Research prospective customers, examine the evidence, and build a financial case for your next conversation.",
  icons: { icon: (process.env.NEXT_PUBLIC_BASE_PATH || "") + "/first-chair-mark-dark.png" },
};
export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
