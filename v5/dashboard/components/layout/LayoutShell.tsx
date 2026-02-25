"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useTranslation } from "@/lib/i18n";

const COLLAPSED_KEY = "ai-influencer-sidebar-collapsed";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Restore collapsed state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSED_KEY);
    if (stored === "true") setCollapsed(true);
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const handleCloseSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  const handleToggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSED_KEY, String(next));
      return next;
    });
  }, []);

  // API routes and login page don't need layout
  if (pathname.startsWith("/api/") || pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={handleCloseSidebar}
          aria-hidden="true"
        />
      )}

      <Sidebar
        open={sidebarOpen}
        collapsed={collapsed}
        onClose={handleCloseSidebar}
        onToggleCollapse={handleToggleCollapse}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile hamburger bar */}
        <div className="flex items-center md:hidden border-b bg-card px-4 py-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            aria-label={t("sidebar.openMenu")}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Image src="/icon.svg" alt="" width={24} height={24} className="ml-2 shrink-0 rounded" />
          <span className="ml-1.5 font-bold text-primary text-sm">{t("sidebar.appTitle")}</span>
        </div>
        <Header />
        {/* Main content — independently scrollable */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
