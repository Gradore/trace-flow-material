import { Navigate, useLocation } from "react-router-dom";
import { Loader2, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { accessRuleForPath, landingPathForRole } from "@/components/layout/navigation";
import { AppLayout } from "@/components/layout/AppLayout";

/**
 * Route guard. The access rule is derived from the navigation definition, so
 * a menu entry and its route can never disagree about who may open a page.
 */
export function RoleRoute({ children, withLayout = true }: { children: React.ReactNode; withLayout?: boolean }) {
  const { user, loading } = useAuth();
  const { role, isLoading: roleLoading } = useUserRole();
  const location = useLocation();

  if (loading || (user && roleLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  const rule = accessRuleForPath(location.pathname);
  const allowed = !rule
    ? true
    : rule.adminOnly
      ? role === "admin"
      : !rule.roles || (!!role && rule.roles.includes(role));

  if (!allowed) {
    const content = <AccessDenied role={role} />;
    return withLayout ? <AppLayout>{content}</AppLayout> : content;
  }

  return <>{withLayout ? <AppLayout>{children}</AppLayout> : children}</>;
}

function AccessDenied({ role }: { role: string | null }) {
  const home = landingPathForRole(role);
  return (
    <div className="flex items-center justify-center py-16">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldOff className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="text-lg font-semibold">Kein Zugriff</h1>
          <p className="text-sm text-muted-foreground">
            Ihre Rolle{role ? ` „${role}“` : ""} ist für diesen Bereich nicht freigeschaltet.
            Wenden Sie sich an einen Administrator, wenn Sie Zugriff benötigen.
          </p>
          <Button asChild variant="outline" className="mt-2">
            <a href={home}>Zur Startseite</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/** Sends each role to the entry point it is actually allowed to use. */
export function RoleLandingRedirect({ children }: { children: React.ReactNode }) {
  const { role, isLoading } = useUserRole();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  const target = landingPathForRole(role);
  if (target !== "/") return <Navigate to={target} replace />;
  return <>{children}</>;
}
