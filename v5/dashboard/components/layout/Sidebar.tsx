"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  X,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  BarChart3,
  Users,
  UserCircle,
  FileText,
  Factory,
  CheckSquare,
  Star,
  TrendingUp,
  Lightbulb,
  BookOpen,
  Bot,
  MessageSquare,
  Wrench,
  AlertTriangle,
  DollarSign,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  section?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, section: "overview" },
  { href: "/kpi", label: "KPI", icon: BarChart3, section: "overview" },
  { href: "/accounts", label: "Accounts", icon: Users, section: "management" },
  { href: "/characters", label: "Characters", icon: UserCircle, section: "management" },
  { href: "/content", label: "Content", icon: FileText, section: "content" },
  { href: "/production", label: "Production", icon: Factory, section: "content" },
  { href: "/review", label: "Review", icon: CheckSquare, section: "content" },
  { href: "/curation", label: "Curation", icon: Star, section: "content" },
  { href: "/performance", label: "Performance", icon: TrendingUp, section: "analytics" },
  { href: "/hypotheses", label: "Hypotheses", icon: Lightbulb, section: "analytics" },
  { href: "/learnings", label: "Learnings", icon: BookOpen, section: "analytics" },
  { href: "/agents", label: "Agents", icon: Bot, section: "system" },
  { href: "/directives", label: "Directives", icon: MessageSquare, section: "system" },
  { href: "/tools", label: "Tools", icon: Wrench, section: "system" },
  { href: "/errors", label: "Errors", icon: AlertTriangle, section: "system" },
  { href: "/costs", label: "Costs", icon: DollarSign, section: "system" },
  { href: "/settings", label: "Settings", icon: Settings, section: "system" },
];

const SECTIONS: Record<string, string> = {
  overview: "Overview",
  management: "Management",
  content: "Content",
  analytics: "Analytics",
  system: "System",
};

interface SidebarProps {
  open?: boolean;
  collapsed?: boolean;
  onClose?: () => void;
  onToggleCollapse?: () => void;
}

export function Sidebar({ open, collapsed, onClose, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();

  const grouped = Object.entries(SECTIONS).map(([key, label]) => ({
    key,
    label,
    items: NAV_ITEMS.filter((item) => item.section === key),
  }));

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  return (
    <aside
      className={cn(
        "h-full bg-card border-r flex flex-col transition-all duration-200 ease-in-out",
        // Mobile: fixed overlay, hidden by default
        "fixed inset-y-0 left-0 z-40 md:static md:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
        collapsed ? "w-[var(--sidebar-width-collapsed)]" : "w-[var(--sidebar-width)]"
      )}
    >
      {/* Header */}
      <div className={cn("flex items-center border-b", collapsed ? "justify-center p-2" : "justify-between p-4")}>
        {!collapsed && (
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-primary truncate">AI Influencer</h2>
            <p className="text-xs text-muted-foreground">v5.0</p>
          </div>
        )}
        {/* Mobile close button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden shrink-0"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </Button>
        {/* Desktop collapse toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:flex shrink-0"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Nav — independently scrollable */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-3">
        {grouped.map((section) => (
          <div key={section.key}>
            {!collapsed && (
              <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {section.label}
              </p>
            )}
            {collapsed && <Separator className="my-1" />}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Button
                    key={item.href}
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className={cn(
                      "w-full",
                      collapsed ? "justify-center px-0" : "justify-start",
                      isActive && "font-semibold"
                    )}
                    asChild
                    onClick={handleNavClick}
                    title={collapsed ? item.label : undefined}
                  >
                    <Link href={item.href}>
                      <Icon className={cn("h-4 w-4 shrink-0", !collapsed && "mr-2")} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
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
