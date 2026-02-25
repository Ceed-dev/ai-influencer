"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Sun, Moon, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

const THEME_KEY = "ai-influencer-theme";

export function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { t, lang, setLang } = useTranslation();
  const title = t(`pageTitles.${pathname}`) || "AI Influencer";
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
        <h1 className="text-lg font-bold">{title}</h1>
        <div className="flex items-center gap-3">
          {session?.user && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {session.user.email}
              </span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {session.user.role}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut({ callbackUrl: "/login" })}
                aria-label={t("header.signOut")}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
          <button
            type="button"
            role="switch"
            aria-checked={lang === "ja"}
            aria-label="Toggle language"
            onClick={() => setLang(lang === "en" ? "ja" : "en")}
            className="relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-input shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="absolute left-1.5 text-[10px] font-bold text-muted-foreground select-none">EN</span>
            <span className="absolute right-1.5 text-[10px] font-bold text-muted-foreground select-none">JA</span>
            <span
              className="pointer-events-none flex h-5 w-5 items-center justify-center rounded-full bg-primary shadow-lg transition-transform duration-200 data-[state=checked]:translate-x-7 data-[state=unchecked]:translate-x-0.5"
              data-state={lang === "ja" ? "checked" : "unchecked"}
            >
              <span className="text-[9px] font-bold text-primary-foreground select-none">
                {lang === "en" ? "EN" : "JA"}
              </span>
            </span>
          </button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? t("header.switchToLight") : t("header.switchToDark")}
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
