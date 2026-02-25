"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Sun, Moon, LogOut, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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

  const toggleLang = () => {
    setLang(lang === "en" ? "ja" : "en");
  };

  return (
    <header className="border-b bg-card">
      <div className="flex items-center justify-between px-6 py-3">
        <div>
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="text-xs text-muted-foreground">{pathname}</p>
        </div>
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
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleLang}
            aria-label="Toggle language"
            title={lang === "en" ? "日本語に切り替え" : "Switch to English"}
          >
            <Globe className="h-4 w-4" />
          </Button>
          <span className="text-xs font-medium text-muted-foreground w-5">
            {lang === "en" ? "EN" : "JA"}
          </span>
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
      <Separator />
    </header>
  );
}
