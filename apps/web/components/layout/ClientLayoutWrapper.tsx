"use client";

import { usePathname } from "next/navigation";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";

export default function ClientLayoutWrapper({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();

  // The landing page and room pages provide their own chrome. Wrapping either
  // would render a second header (and, on the landing page, an unrelated
  // sidebar) above the intended cinema experience.
  if (pathname === "/" || pathname?.startsWith("/rooms/")) {
    return <>{children}</>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Topbar currentUser={undefined} onProfileClick={() => {}} />
      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
        <Sidebar />
        <main style={{ flex: 1, overflow: "auto", padding: 0 }}>{children}</main>
      </div>
    </div>
  );
}
