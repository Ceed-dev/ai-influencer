"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const handleCloseSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  // API routes and login page don't need layout
  if (pathname.startsWith("/api/") || pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={handleCloseSidebar}
          aria-hidden="true"
        />
      )}

      <Sidebar open={sidebarOpen} onClose={handleCloseSidebar} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile hamburger + Header */}
        <div className="flex items-center md:hidden border-b bg-card px-4 py-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="ml-2 font-bold text-primary text-sm">AI Influencer</span>
        </div>
        <Header />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
