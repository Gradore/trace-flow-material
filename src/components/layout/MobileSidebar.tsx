import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ChevronDown, QrCode } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ACCENT_STYLES, activePath, hasAccess, visibleGroups } from "./navigation";
import rekuflowLogo from "@/assets/rekuflow-logo.png";

interface MobileSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileSidebar({ open, onOpenChange }: MobileSidebarProps) {
  const location = useLocation();
  const { role, isLoading, isAdmin } = useUserRole();

  const groups = useMemo(() => visibleGroups(role, isAdmin), [role, isAdmin]);
  const current = useMemo(() => activePath(location.pathname, role, isAdmin), [location.pathname, role, isAdmin]);

  const groupOfCurrent = useMemo(
    () => groups.find((g) => g.items.some((i) => i.path === current))?.id ?? null,
    [groups, current],
  );

  const canScan = hasAccess("/scan", role, isAdmin);

  const [openGroups, setOpenGroups] = useState<string[]>([]);

  // The role is unknown on the first render, so the default-open groups can
  // only be resolved once it has loaded.
  useEffect(() => {
    if (isLoading) return;
    setOpenGroups((prev) => {
      const defaults = groups.filter((g) => g.defaultOpen).map((g) => g.id);
      const missing = defaults.filter((id) => !prev.includes(id));
      return missing.length ? [...prev, ...missing] : prev;
    });
  }, [isLoading, groups]);

  useEffect(() => {
    if (groupOfCurrent) {
      setOpenGroups((prev) => (prev.includes(groupOfCurrent) ? prev : [...prev, groupOfCurrent]));
    }
  }, [groupOfCurrent]);

  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));

  const handleNavClick = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[300px] p-0 bg-sidebar border-sidebar-border flex flex-col">
        <SheetHeader className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <img src={rekuflowLogo} alt="RekuFLOW Logo" className="h-10 w-10 object-contain" />
            <SheetTitle className="text-sidebar-foreground text-lg font-bold">RekuFLOW</SheetTitle>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <nav className="p-3 space-y-1" aria-label="Hauptnavigation">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              groups.map((group) => {
                const accent = ACCENT_STYLES[group.accent];
                const isOpen = openGroups.includes(group.id);
                const containsActive = group.items.some((i) => i.path === current);
                return (
                  <div key={group.id} className="pb-1">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      aria-expanded={isOpen}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide hover:bg-sidebar-accent transition-colors",
                        accent.groupLabel,
                      )}
                    >
                      <group.icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left truncate">{group.label}</span>
                      {!isOpen && containsActive && (
                        <span className={cn("h-1.5 w-1.5 rounded-full", accent.dot)} aria-hidden />
                      )}
                      <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", !isOpen && "-rotate-90")} />
                    </button>

                    {isOpen && (
                      <div className="mt-1 space-y-0.5 pl-3 border-l border-sidebar-border ml-4">
                        {group.items.map((item) => {
                          const isActive = item.path === current;
                          return (
                            <NavLink
                              key={item.path}
                              to={item.path}
                              onClick={handleNavClick}
                              className={cn(
                                "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                                isActive
                                  ? cn(accent.activeBg, accent.activeText, "font-medium")
                                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
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
              })
            )}
          </nav>
        </ScrollArea>

        {canScan && (
        <div className="p-3 border-t border-sidebar-border">
          <NavLink
            to="/scan"
            onClick={handleNavClick}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium transition-all hover:bg-primary/90"
          >
            <QrCode className="h-5 w-5" />
            <span>QR Scannen</span>
          </NavLink>
        </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
