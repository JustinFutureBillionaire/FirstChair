import "@fontsource-variable/schibsted-grotesk/wght.css";
import "@fontsource-variable/newsreader/wght.css";
import "./globals.css";

export const metadata = {
  title: "First Chair",
  description: "Describe your product. First Chair finds the companies that need it now, proves why with sources, and drafts the first email.",
  icons: { icon: (process.env.NEXT_PUBLIC_BASE_PATH || "") + "/first-chair-mark-dark.png" },
};
export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
