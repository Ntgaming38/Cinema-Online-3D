import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TCG Cinema — Xem phim cùng bạn bè",
  description: "Không gian rạp chiếu phim online 3D cùng bạn bè."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
