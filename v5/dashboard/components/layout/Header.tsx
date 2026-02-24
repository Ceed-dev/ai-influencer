"use client";

import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/kpi": "KPI Dashboard",
  "/accounts": "Account Management",
  "/characters": "Characters",
  "/content": "Content",
  "/production": "Production Pipeline",
  "/review": "Content Review",
  "/curation": "Curation Review",
  "/performance": "Performance",
  "/hypotheses": "Hypotheses",
  "/learnings": "Learnings",
  "/agents": "Agent Management",
  "/directives": "Human Directives",
  "/tools": "Tool Catalog",
  "/errors": "Error Log",
  "/costs": "Cost Management",
  "/settings": "Settings",
};

export function Header() {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] || "AI Influencer";

  return (
    <header className="border-b bg-card">
      <div className="flex items-center justify-between px-6 py-3">
        <div>
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="text-xs text-muted-foreground">{pathname}</p>
        </div>
      </div>
      <Separator />
    </header>
  );
}
