import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Recycle, Loader2, Info, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

const loginSchema = z.object({
  username: z.string().min(1, "Benutzername ist erforderlich"),
  password: z.string().min(6, "Passwort muss mindestens 6 Zeichen haben"),
});

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const [forceLogout, setForceLogout] = useState(false);

  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // If the user navigated to /auth with ?logout=true, force a sign out.
  useEffect(() => {
    const shouldLogout = searchParams.get("logout") === "true";
    if (shouldLogout && !forceLogout) {
      setForceLogout(true);
      supabase.auth.signOut().then(() => {
        window.history.replaceState({}, "", "/auth");
      });
    }
  }, [searchParams, forceLogout]);

  // Redirect if already logged in (but not while forcing a logout).
  useEffect(() => {
    if (user && !forceLogout) {
      navigate("/", { replace: true });
    }
  }, [user, forceLogout, navigate]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotPasswordEmail || !z.string().email().safeParse(forgotPasswordEmail).success) {
      toast({
        variant: "destructive",
        title: "Ungültige E-Mail",
        description: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
      });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setIsLoading(false);

    if (error) {
      toast({ variant: "destructive", title: "Fehler", description: error.message });
      return;
    }

    setForgotPasswordSent(true);
    toast({
      title: "E-Mail gesendet",
      description: "Falls ein Konto mit dieser E-Mail existiert, erhalten Sie einen Link zum Zurücksetzen des Passworts.",
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validation = loginSchema.safeParse({ username: loginUsername, password: loginPassword });
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[`login_${err.path[0]}`] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      // Look up the login e-mail by username.
      const { data: email, error: lookupError } = await supabase.rpc("get_email_by_username", {
        _username: loginUsername.toLowerCase(),
      });

      if (lookupError || !email) {
        toast({
          variant: "destructive",
          title: "Anmeldung fehlgeschlagen",
          description: "Benutzername oder Passwort ungültig",
        });
        setIsLoading(false);
        return;
      }

      const { error } = await signIn(email, loginPassword);
      setIsLoading(false);

      if (error) {
        toast({
          variant: "destructive",
          title: "Anmeldung fehlgeschlagen",
          description: "Benutzername oder Passwort ungültig",
        });
        return;
      }

      navigate("/");
    } catch {
      setIsLoading(false);
      toast({
        variant: "destructive",
        title: "Anmeldung fehlgeschlagen",
        description: "Ein unerwarteter Fehler ist aufgetreten",
      });
    }
  };

  const brandHeader = (
    <div className="flex items-center justify-center gap-2 mb-4">
      <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
        <Recycle className="h-6 w-6 text-primary" />
      </div>
      <span className="text-2xl font-bold">RekuFLOW</span>
    </div>
  );

  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            {brandHeader}
            <CardTitle>Passwort zurücksetzen</CardTitle>
            <CardDescription>
              {forgotPasswordSent ? "E-Mail wurde gesendet" : "Geben Sie Ihre E-Mail-Adresse ein"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {forgotPasswordSent ? (
              <>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Falls ein Konto mit der E-Mail <strong>{forgotPasswordEmail}</strong> existiert,
                    erhalten Sie in Kürze einen Link zum Zurücksetzen des Passworts.
                  </AlertDescription>
                </Alert>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotPasswordSent(false);
                    setForgotPasswordEmail("");
                  }}
                >
                  Zurück zur Anmeldung
                </Button>
              </>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">E-Mail</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="name@firma.de"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Link senden
                </Button>
                <Button type="button" className="w-full" variant="outline" onClick={() => setShowForgotPassword(false)}>
                  Zurück
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {brandHeader}
          <CardTitle>Anmelden</CardTitle>
          <CardDescription>Materialfluss-Tracking für die Recycling-Industrie</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-username">Benutzername</Label>
              <Input
                id="login-username"
                type="text"
                autoComplete="username"
                placeholder="benutzername"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                disabled={isLoading}
              />
              {errors.login_username && <p className="text-sm text-destructive">{errors.login_username}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Passwort</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                disabled={isLoading}
              />
              {errors.login_password && <p className="text-sm text-destructive">{errors.login_password}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Anmelden
            </Button>
            <div className="text-center">
              <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                Passwort vergessen?
              </Link>
            </div>
          </form>

          <Alert className="mt-6 bg-muted">
            <ShieldCheck className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Eine Selbstregistrierung ist nicht möglich. Zugänge werden ausschließlich von einem
              Administrator angelegt. Wenden Sie sich bei Bedarf an Ihren Ansprechpartner.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
