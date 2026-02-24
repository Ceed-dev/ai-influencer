"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
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

const THEME_KEY = "ai-influencer-theme";

export function Header() {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] || "AI Influencer";
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // On mount, read persisted theme from localStorage and apply
  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    const initial = stored === "light" ? "light" : "dark";
    setTheme(initial);
    if (initial === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    if (next === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  };

  return (
    <header className="border-b bg-card">
      <div className="flex items-center justify-between px-6 py-3">
        <div>
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="text-xs text-muted-foreground">{pathname}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>
      </div>
      <Separator />
    </header>
  );
}
