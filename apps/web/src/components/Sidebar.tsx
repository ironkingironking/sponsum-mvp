"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sidebarLinks = [
  { href: "/dashboard", label: "Overview" },
  { href: "/deals?view=claims", label: "My Claims" },
  { href: "/deals?view=investments", label: "Investments" },
  { href: "/disputes", label: "Disputes" },
  { href: "/profile", label: "Settings" }
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="app-sidebar">
      <p className="app-sidebar-title">Workspace</p>
      <nav>
        {sidebarLinks.map((item) => {
          const isActive = pathname === item.href || (item.href.includes("?") && pathname.startsWith(item.href.split("?")[0]));
          return (
            <Link key={item.href} href={item.href} className={isActive ? "active" : ""}>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
