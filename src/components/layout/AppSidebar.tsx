import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronLeft, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ACCENT_STYLES, activePath, hasAccess, visibleGroups, type NavGroup } from "./navigation";
import rekuflowLogo from "@/assets/rekuflow-logo.png";

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const STORAGE_KEY = "rekuflow.sidebar.openGroups";

function readOpenGroups(): string[] | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : null;
  } catch {
    return null;
  }
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const location = useLocation();
  const { role, isLoading, isAdmin } = useUserRole();

  const groups = useMemo(() => visibleGroups(role, isAdmin), [role, isAdmin]);
  const current = useMemo(() => activePath(location.pathname, role, isAdmin), [location.pathname, role, isAdmin]);

  const groupOfCurrent = useMemo(
    () => groups.find((g) => g.items.some((i) => i.path === current))?.id ?? null,
    [groups, current],
  );

  const canScan = hasAccess("/scan", role, isAdmin);

  const [openGroups, setOpenGroups] = useState<string[]>(() => readOpenGroups() ?? []);
  const [restoredFromStorage] = useState<boolean>(() => readOpenGroups() !== null);

  // The role is not known on the first render, so the role-gated groups that
  // should start expanded are only known once it has loaded.
  useEffect(() => {
    if (isLoading || restoredFromStorage) return;
    setOpenGroups((prev) => {
      const defaults = NAV_DEFAULT_OPEN(groups);
      const missing = defaults.filter((id) => !prev.includes(id));
      return missing.length ? [...prev, ...missing] : prev;
    });
  }, [isLoading, restoredFromStorage, groups]);

  // Keep the group that owns the active route expanded.
  useEffect(() => {
    if (groupOfCurrent && !openGroups.includes(groupOfCurrent)) {
      setOpenGroups((prev) => [...prev, groupOfCurrent]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupOfCurrent]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(openGroups));
    } catch {
      /* storage unavailable - expansion state simply is not remembered */
    }
  }, [openGroups]);

  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 flex-col hidden md:flex",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 p-4 border-b border-sidebar-border h-16">
        <img src={rekuflowLogo} alt="RekuFLOW Logo" className="h-10 w-10 object-contain shrink-0" />
        {!collapsed && (
          <div className="flex flex-col animate-fade-in overflow-hidden">
            <span className="font-bold text-sidebar-foreground text-lg truncate">RekuFLOW</span>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <nav className="p-2 space-y-1" aria-label="Hauptnavigation">
          {isLoading ? (
            <div className="space-y-2 p-1">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            groups.map((group) => (
              <SidebarGroup
                key={group.id}
                group={group}
                collapsed={collapsed}
                open={openGroups.includes(group.id)}
                currentPath={current}
                onToggle={() => toggleGroup(group.id)}
              />
            ))
          )}
        </nav>
      </ScrollArea>

      {/* QR Scanner quick action */}
      {canScan && (
      <div className="p-2 border-t border-sidebar-border">
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <NavLink
                to="/scan"
                className="flex items-center justify-center w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium transition-all hover:bg-primary/90"
              >
                <QrCode className="h-5 w-5" />
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">QR Scannen</TooltipContent>
          </Tooltip>
        ) : (
          <NavLink
            to="/scan"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium transition-all hover:bg-primary/90"
          >
            <QrCode className="h-5 w-5" />
            <span>QR Scannen</span>
          </NavLink>
        )}
      </div>
      )}

      <div className="p-2 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className={cn(
            "w-full text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
            collapsed && "justify-center",
          )}
        >
          <ChevronLeft className={cn("h-5 w-5 transition-transform", collapsed && "rotate-180")} />
          {!collapsed && <span className="ml-2">Einklappen</span>}
        </Button>
      </div>
    </aside>
  );
}

function NAV_DEFAULT_OPEN(groups: NavGroup[]): string[] {
  return groups.filter((g) => g.defaultOpen).map((g) => g.id);
}

interface SidebarGroupProps {
  group: NavGroup;
  collapsed: boolean;
  open: boolean;
  currentPath: string | null;
  onToggle: () => void;
}

function SidebarGroup({ group, collapsed, open, currentPath, onToggle }: SidebarGroupProps) {
  const accent = ACCENT_STYLES[group.accent];
  const containsActive = group.items.some((item) => item.path === currentPath);

  // Collapsed rail: no group headers, just colour-coded icons with tooltips.
  if (collapsed) {
    return (
      <div className="space-y-1 py-1 first:pt-0">
        <div className="mx-auto h-px w-6 bg-sidebar-border" aria-hidden />
        {group.items.map((item) => {
          const isActive = item.path === currentPath;
          return (
            <Tooltip key={item.path} delayDuration={0}>
              <TooltipTrigger asChild>
                <NavLink
                  to={item.path}
                  className={cn(
                    "group relative flex items-center justify-center px-2 py-2.5 rounded-lg transition-colors",
                    isActive ? cn(accent.activeBg, accent.activeText) : "hover:bg-sidebar-accent",
                  )}
                >
                  {isActive && (
                    <span className={cn("absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full", accent.bar)} />
                  )}
                  <item.icon className={cn("h-5 w-5 shrink-0", isActive ? accent.iconActive : accent.icon)} />
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium">
                <span className="text-muted-foreground">{group.label} · </span>
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    );
  }

  return (
    <div className="pb-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors",
          "hover:bg-sidebar-accent",
          accent.groupLabel,
        )}
      >
        <group.icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left truncate">{group.label}</span>
        {!open && containsActive && <span className={cn("h-1.5 w-1.5 rounded-full", accent.dot)} aria-hidden />}
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", !open && "-rotate-90")} />
      </button>

      {open && (
        <div className="mt-1 space-y-0.5 pl-3 border-l border-sidebar-border ml-4">
          {group.items.map((item) => {
            const isActive = item.path === currentPath;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  "group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  isActive
                    ? cn(accent.activeBg, accent.activeText, "font-medium")
                    : cn("text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground", accent.hoverText),
                )}
              >
                {isActive && (
                  <span className={cn("absolute -left-3 top-1 bottom-1 w-0.5 rounded-full", accent.bar)} aria-hidden />
                )}
                <item.icon className={cn("h-4 w-4 shrink-0", isActive ? accent.iconActive : accent.icon)} />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}
