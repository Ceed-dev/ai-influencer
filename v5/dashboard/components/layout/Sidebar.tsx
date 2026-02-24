"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface NavItem {
  href: string;
  label: string;
  section?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", section: "overview" },
  { href: "/kpi", label: "KPI", section: "overview" },
  { href: "/accounts", label: "Accounts", section: "management" },
  { href: "/characters", label: "Characters", section: "management" },
  { href: "/content", label: "Content", section: "content" },
  { href: "/production", label: "Production", section: "content" },
  { href: "/review", label: "Review", section: "content" },
  { href: "/curation", label: "Curation", section: "content" },
  { href: "/performance", label: "Performance", section: "analytics" },
  { href: "/hypotheses", label: "Hypotheses", section: "analytics" },
  { href: "/learnings", label: "Learnings", section: "analytics" },
  { href: "/agents", label: "Agents", section: "system" },
  { href: "/directives", label: "Directives", section: "system" },
  { href: "/tools", label: "Tools", section: "system" },
  { href: "/errors", label: "Errors", section: "system" },
  { href: "/costs", label: "Costs", section: "system" },
  { href: "/settings", label: "Settings", section: "system" },
];

const SECTIONS: Record<string, string> = {
  overview: "Overview",
  management: "Management",
  content: "Content",
  analytics: "Analytics",
  system: "System",
};

export function Sidebar() {
  const pathname = usePathname();

  const grouped = Object.entries(SECTIONS).map(([key, label]) => ({
    label,
    items: NAV_ITEMS.filter((item) => item.section === key),
  }));

  return (
    <aside className="w-56 min-h-screen bg-card border-r flex flex-col">
      <div className="p-4">
        <h2 className="text-lg font-bold text-primary">AI Influencer</h2>
        <p className="text-xs text-muted-foreground">v5.0 Dashboard</p>
      </div>
      <Separator />
      <nav className="flex-1 p-2 space-y-4 overflow-y-auto">
        {grouped.map((section) => (
          <div key={section.label}>
            <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Button
                    key={item.href}
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className={cn(
                      "w-full justify-start",
                      isActive && "font-semibold"
                    )}
                    asChild
                  >
                    <Link href={item.href}>{item.label}</Link>
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
