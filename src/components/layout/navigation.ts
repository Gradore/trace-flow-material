import {
  Activity, Archive, BarChart3, Beaker, Boxes, Building2, ClipboardList, Cog,
  FileCode, FileOutput, FileText, FlaskConical, FolderOpen, GitBranch, History,
  Inbox, LayoutDashboard, Mail, Package, Rocket, ScrollText, Search, Settings,
  Shield, ShieldAlert, ShoppingCart, SlidersHorizontal, Sparkles, Tag, Target,
  Truck, Upload, User, Users, Wrench,
} from "lucide-react";

export interface NavItem {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  /** Roles allowed to see the entry. Omit for "everyone who is logged in". */
  roles?: string[];
  adminOnly?: boolean;
}

export type NavAccent =
  | "teal" | "violet" | "emerald" | "sky" | "amber" | "fuchsia" | "cyan" | "rose" | "slate";

export interface NavGroup {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  accent: NavAccent;
  items: NavItem[];
  /** Groups start collapsed unless they contain the active route. */
  defaultOpen?: boolean;
}

/**
 * Accent styles per group. The class strings are written out in full so the
 * Tailwind JIT compiler can see them - never build them by interpolation.
 */
export const ACCENT_STYLES: Record<NavAccent, {
  icon: string; iconActive: string; activeBg: string; activeText: string;
  bar: string; groupLabel: string; dot: string; hoverText: string;
}> = {
  teal: {
    icon: "text-teal-300/70", iconActive: "text-teal-300",
    activeBg: "bg-teal-400/15", activeText: "text-teal-200",
    bar: "bg-teal-400", groupLabel: "text-teal-300/80", dot: "bg-teal-400",
    hoverText: "group-hover:text-teal-200",
  },
  violet: {
    icon: "text-violet-300/70", iconActive: "text-violet-300",
    activeBg: "bg-violet-400/15", activeText: "text-violet-200",
    bar: "bg-violet-400", groupLabel: "text-violet-300/80", dot: "bg-violet-400",
    hoverText: "group-hover:text-violet-200",
  },
  emerald: {
    icon: "text-emerald-300/70", iconActive: "text-emerald-300",
    activeBg: "bg-emerald-400/15", activeText: "text-emerald-200",
    bar: "bg-emerald-400", groupLabel: "text-emerald-300/80", dot: "bg-emerald-400",
    hoverText: "group-hover:text-emerald-200",
  },
  sky: {
    icon: "text-sky-300/70", iconActive: "text-sky-300",
    activeBg: "bg-sky-400/15", activeText: "text-sky-200",
    bar: "bg-sky-400", groupLabel: "text-sky-300/80", dot: "bg-sky-400",
    hoverText: "group-hover:text-sky-200",
  },
  amber: {
    icon: "text-amber-300/70", iconActive: "text-amber-300",
    activeBg: "bg-amber-400/15", activeText: "text-amber-200",
    bar: "bg-amber-400", groupLabel: "text-amber-300/80", dot: "bg-amber-400",
    hoverText: "group-hover:text-amber-200",
  },
  fuchsia: {
    icon: "text-fuchsia-300/70", iconActive: "text-fuchsia-300",
    activeBg: "bg-fuchsia-400/15", activeText: "text-fuchsia-200",
    bar: "bg-fuchsia-400", groupLabel: "text-fuchsia-300/80", dot: "bg-fuchsia-400",
    hoverText: "group-hover:text-fuchsia-200",
  },
  cyan: {
    icon: "text-cyan-300/70", iconActive: "text-cyan-300",
    activeBg: "bg-cyan-400/15", activeText: "text-cyan-200",
    bar: "bg-cyan-400", groupLabel: "text-cyan-300/80", dot: "bg-cyan-400",
    hoverText: "group-hover:text-cyan-200",
  },
  rose: {
    icon: "text-rose-300/70", iconActive: "text-rose-300",
    activeBg: "bg-rose-400/15", activeText: "text-rose-200",
    bar: "bg-rose-400", groupLabel: "text-rose-300/80", dot: "bg-rose-400",
    hoverText: "group-hover:text-rose-200",
  },
  slate: {
    icon: "text-slate-300/70", iconActive: "text-slate-200",
    activeBg: "bg-slate-400/15", activeText: "text-slate-100",
    bar: "bg-slate-400", groupLabel: "text-slate-300/80", dot: "bg-slate-400",
    hoverText: "group-hover:text-slate-100",
  },
};

const STAFF = ["admin", "betriebsleiter", "intake", "production", "qa"];
/** The GFK planning & test phase is internal engineering work. */
const PROJECT_ROLES = ["admin", "betriebsleiter", "production", "qa", "intake"];

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "Übersicht",
    icon: LayoutDashboard,
    accent: "teal",
    defaultOpen: true,
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/", roles: STAFF },
      { icon: BarChart3, label: "Reporting", path: "/reporting", roles: ["admin", "intake", "production", "qa"] },
    ],
  },
  {
    id: "project",
    label: "GFK-Projekt",
    icon: Rocket,
    accent: "violet",
    defaultOpen: true,
    items: [
      { icon: Rocket, label: "Projekt-Cockpit", path: "/projekt", roles: PROJECT_ROLES },
      { icon: Target, label: "Phasen & Aufgaben", path: "/projekt/aufgaben", roles: PROJECT_ROLES },
      { icon: Users, label: "Projektpartner", path: "/projekt/partner", roles: PROJECT_ROLES },
      { icon: Boxes, label: "Materialchargen", path: "/projekt/chargen", roles: PROJECT_ROLES },
      { icon: FlaskConical, label: "Versuchsläufe", path: "/projekt/versuche", roles: PROJECT_ROLES },
      { icon: GitBranch, label: "DoE-Serien", path: "/projekt/doe", roles: PROJECT_ROLES },
      { icon: Package, label: "Zielfraktionen", path: "/projekt/fraktionen", roles: PROJECT_ROLES },
      { icon: Beaker, label: "Analytik", path: "/projekt/analytik", roles: PROJECT_ROLES },
      { icon: Activity, label: "Produkttests", path: "/projekt/produkttests", roles: PROJECT_ROLES },
      { icon: History, label: "Materialfluss", path: "/projekt/materialfluss", roles: PROJECT_ROLES },
      { icon: Mail, label: "Mailvorlagen", path: "/projekt/mailvorlagen", roles: PROJECT_ROLES },
      { icon: ShieldAlert, label: "Risiken", path: "/projekt/risiken", roles: PROJECT_ROLES },
      { icon: Sparkles, label: "KI-Auswertungen", path: "/projekt/ki", roles: PROJECT_ROLES },
    ],
  },
  {
    id: "operations",
    label: "Betrieb",
    icon: Cog,
    accent: "emerald",
    items: [
      { icon: Inbox, label: "Materialeingang", path: "/intake", roles: ["admin", "betriebsleiter", "intake", "production"] },
      { icon: Package, label: "Container", path: "/containers", roles: ["admin", "betriebsleiter", "intake", "production", "qa", "logistics"] },
      { icon: Cog, label: "Verarbeitung", path: "/processing", roles: ["admin", "betriebsleiter", "production"] },
      { icon: FlaskConical, label: "Beprobung", path: "/sampling", roles: ["admin", "betriebsleiter", "qa", "production"] },
      { icon: FileOutput, label: "Ausgangsmaterial", path: "/output", roles: ["admin", "betriebsleiter", "production", "qa"] },
      { icon: Beaker, label: "Rückstellmuster", path: "/retention-samples", roles: ["admin", "betriebsleiter", "qa", "production"] },
      { icon: Wrench, label: "Wartung", path: "/maintenance", roles: ["admin", "betriebsleiter", "production"] },
    ],
  },
  {
    id: "commerce",
    label: "Vertrieb & Logistik",
    icon: ShoppingCart,
    accent: "sky",
    items: [
      { icon: ClipboardList, label: "Aufträge", path: "/orders", roles: ["admin", "betriebsleiter", "intake", "production", "qa", "customer"] },
      { icon: Building2, label: "Firmen", path: "/companies", roles: ["admin", "betriebsleiter", "intake", "logistics"] },
      { icon: FileText, label: "Lieferscheine", path: "/delivery-notes", roles: ["admin", "betriebsleiter", "intake", "production", "logistics"] },
      { icon: Truck, label: "Logistik", path: "/logistics", roles: ["admin", "betriebsleiter", "logistics"] },
    ],
  },
  {
    id: "documents",
    label: "Dokumente & Rückverfolgung",
    icon: FolderOpen,
    accent: "amber",
    items: [
      { icon: FolderOpen, label: "Dokumente", path: "/documents", roles: STAFF },
      { icon: Upload, label: "Datenblatt-Upload", path: "/datasheet-upload", roles: ["admin", "intake", "production", "qa"] },
      { icon: Tag, label: "Etiketten", path: "/labels", roles: ["admin", "betriebsleiter", "production", "intake", "qa"] },
      { icon: History, label: "Rückverfolgung", path: "/traceability", roles: STAFF },
      { icon: Archive, label: "Archiv", path: "/archive", roles: STAFF },
    ],
  },
  {
    id: "ai-tools",
    label: "KI-Werkzeuge",
    icon: Sparkles,
    accent: "fuchsia",
    items: [
      { icon: Sparkles, label: "KI Rezepturen", path: "/recipe-matching", roles: ["admin", "production", "qa", "intake"] },
      { icon: Search, label: "KI Vertrieb", path: "/sales-search", roles: ["admin", "production", "qa", "intake"] },
    ],
  },
  {
    id: "portals",
    label: "Portale",
    icon: ShoppingCart,
    accent: "cyan",
    defaultOpen: true,
    items: [
      { icon: ShoppingCart, label: "Kunden-Portal", path: "/customer-portal", roles: ["customer"] },
      { icon: Package, label: "Lieferanten-Portal", path: "/supplier-portal", roles: ["supplier"] },
    ],
  },
  {
    id: "administration",
    label: "Verwaltung",
    icon: Shield,
    accent: "rose",
    items: [
      { icon: Users, label: "Benutzer", path: "/users", roles: ["admin", "betriebsleiter"] },
      { icon: Shield, label: "Benutzerverwaltung", path: "/admin/users", adminOnly: true },
      { icon: ScrollText, label: "Audit-Log", path: "/audit-logs", roles: ["admin", "betriebsleiter"] },
      { icon: Settings, label: "Einstellungen", path: "/settings", roles: ["admin", "betriebsleiter"] },
      { icon: SlidersHorizontal, label: "Admin-Einstellungen", path: "/admin-settings", adminOnly: true },
      { icon: FileCode, label: "API-Docs", path: "/api-docs", roles: ["admin"] },
    ],
  },
  {
    id: "account",
    label: "Konto",
    icon: User,
    accent: "slate",
    items: [
      { icon: User, label: "Mein Profil", path: "/profile" },
    ],
  },
];

export function isItemVisible(item: NavItem, role: string | null, isAdmin: boolean): boolean {
  if (item.adminOnly) return isAdmin;
  if (item.roles) return !!role && item.roles.includes(role);
  return true;
}

/** Groups with their visible items; empty groups are dropped. */
export function visibleGroups(role: string | null, isAdmin: boolean): NavGroup[] {
  return NAV_GROUPS
    .map((group) => ({ ...group, items: group.items.filter((item) => isItemVisible(item, role, isAdmin)) }))
    .filter((group) => group.items.length > 0);
}

/** Flat list - used by the collapsed rail and by the global search. */
export function visibleItems(role: string | null, isAdmin: boolean): (NavItem & { accent: NavAccent; groupLabel: string })[] {
  return visibleGroups(role, isAdmin).flatMap((group) =>
    group.items.map((item) => ({ ...item, accent: group.accent, groupLabel: group.label })),
  );
}

/** Deepest matching nav path for a location, so nested routes stay highlighted. */
export function activePath(pathname: string, role: string | null, isAdmin: boolean): string | null {
  const paths = visibleItems(role, isAdmin).map((i) => i.path);
  const exact = paths.find((p) => p === pathname);
  if (exact) return exact;
  const prefixed = paths
    .filter((p) => p !== "/" && pathname.startsWith(`${p}/`))
    .sort((a, b) => b.length - a.length);
  return prefixed[0] ?? null;
}

/**
 * Routes that are reachable but have no menu entry. Everything else derives
 * its access rule from the menu, so route guards and the menu cannot drift.
 */
export const EXTRA_ROUTE_ACCESS: Record<string, { roles?: string[]; adminOnly?: boolean }> = {
  "/scan": { roles: [...STAFF, "logistics"] },
};

export interface AccessRule {
  roles?: string[];
  adminOnly?: boolean;
}

/** Access rule for a concrete pathname, or null when the route is open to all. */
export function accessRuleForPath(pathname: string): AccessRule | null {
  const candidates: { path: string; rule: AccessRule }[] = [
    ...NAV_GROUPS.flatMap((group) =>
      group.items.map((item) => ({
        path: item.path,
        rule: { roles: item.roles, adminOnly: item.adminOnly } as AccessRule,
      })),
    ),
    ...Object.entries(EXTRA_ROUTE_ACCESS).map(([path, rule]) => ({ path, rule })),
  ];

  const exact = candidates.find((c) => c.path === pathname);
  if (exact) return exact.rule.roles || exact.rule.adminOnly ? exact.rule : null;

  const nested = candidates
    .filter((c) => c.path !== "/" && pathname.startsWith(`${c.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
  if (nested) return nested.rule.roles || nested.rule.adminOnly ? nested.rule : null;

  return null;
}

/** May this role open the given path? Mirrors the route guard exactly. */
export function hasAccess(pathname: string, role: string | null, isAdmin: boolean): boolean {
  const rule = accessRuleForPath(pathname);
  if (!rule) return true;
  if (rule.adminOnly) return isAdmin;
  if (!rule.roles) return true;
  return !!role && rule.roles.includes(role);
}

/** Where a role should land after login. */
export function landingPathForRole(role: string | null): string {
  switch (role) {
    case "customer": return "/customer-portal";
    case "supplier": return "/supplier-portal";
    case "logistics": return "/logistics";
    default: return "/";
  }
}
