"use client";

import { usePathname } from "next/navigation";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";

export default function ClientLayoutWrapper({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();

  // Room pages render their own top bar + sidebar (see TheaterRoom);
  // wrapping them in the global chrome would duplicate both.
  if (pathname?.startsWith("/rooms/")) {
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
