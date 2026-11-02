"use client";

import Topbar from "./Topbar";
import Sidebar from "./Sidebar";

export default function ClientLayoutWrapper({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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