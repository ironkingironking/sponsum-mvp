"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideSidebar = pathname.startsWith("/auth");

  return (
    <div className={hideSidebar ? "app-shell no-sidebar" : "app-shell"}>
      {hideSidebar ? null : <Sidebar />}
      <main className="app-main">{children}</main>
    </div>
  );
}

