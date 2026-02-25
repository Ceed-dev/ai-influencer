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
import { useTranslation } from "@/lib/i18n";

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ElementType;
  section?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "sidebar.nav.dashboard", icon: LayoutDashboard, section: "overview" },
  { href: "/kpi", labelKey: "sidebar.nav.kpi", icon: BarChart3, section: "overview" },
  { href: "/accounts", labelKey: "sidebar.nav.accounts", icon: Users, section: "management" },
  { href: "/characters", labelKey: "sidebar.nav.characters", icon: UserCircle, section: "management" },
  { href: "/content", labelKey: "sidebar.nav.content", icon: FileText, section: "content" },
  { href: "/production", labelKey: "sidebar.nav.production", icon: Factory, section: "content" },
  { href: "/review", labelKey: "sidebar.nav.review", icon: CheckSquare, section: "content" },
  { href: "/curation", labelKey: "sidebar.nav.curation", icon: Star, section: "content" },
  { href: "/performance", labelKey: "sidebar.nav.performance", icon: TrendingUp, section: "analytics" },
  { href: "/hypotheses", labelKey: "sidebar.nav.hypotheses", icon: Lightbulb, section: "analytics" },
  { href: "/learnings", labelKey: "sidebar.nav.learnings", icon: BookOpen, section: "analytics" },
  { href: "/agents", labelKey: "sidebar.nav.agents", icon: Bot, section: "system" },
  { href: "/directives", labelKey: "sidebar.nav.directives", icon: MessageSquare, section: "system" },
  { href: "/tools", labelKey: "sidebar.nav.tools", icon: Wrench, section: "system" },
  { href: "/errors", labelKey: "sidebar.nav.errors", icon: AlertTriangle, section: "system" },
  { href: "/costs", labelKey: "sidebar.nav.costs", icon: DollarSign, section: "system" },
  { href: "/settings", labelKey: "sidebar.nav.settings", icon: Settings, section: "system" },
];

const SECTION_KEYS = ["overview", "management", "content", "analytics", "system"] as const;

interface SidebarProps {
  open?: boolean;
  collapsed?: boolean;
  onClose?: () => void;
  onToggleCollapse?: () => void;
}

export function Sidebar({ open, collapsed, onClose, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useTranslation();

  const grouped = SECTION_KEYS.map((key) => ({
    key,
    label: t(`sidebar.sections.${key}`),
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
      <div className={cn("flex items-center border-b", collapsed ? "justify-center py-3 px-2" : "justify-between px-4 py-3")}>
        {!collapsed && (
          <h2 className="text-lg font-bold text-primary truncate">{t("sidebar.appTitle")}</h2>
        )}
        {/* Mobile close button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden shrink-0"
          onClick={onClose}
          aria-label={t("sidebar.closeSidebar")}
        >
          <X className="h-5 w-5" />
        </Button>
        {/* Desktop collapse toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:flex shrink-0"
          onClick={onToggleCollapse}
          aria-label={collapsed ? t("sidebar.expandSidebar") : t("sidebar.collapseSidebar")}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Nav — independently scrollable */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-4">
        {grouped.map((section, idx) => (
          <div key={section.key}>
            {!collapsed && (
              <>
                {idx > 0 && <Separator className="mb-3" />}
                <p className="mb-1 px-3 py-0.5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest border-l-2 border-primary/40">
                  {section.label}
                </p>
              </>
            )}
            {collapsed && section.key !== "overview" && <Separator className="my-1" />}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                const Icon = item.icon;
                const label = t(item.labelKey);
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
                    title={collapsed ? label : undefined}
                  >
                    <Link href={item.href}>
                      <Icon className={cn("h-4 w-4 shrink-0", !collapsed && "mr-2")} />
                      {!collapsed && <span className="truncate">{label}</span>}
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
