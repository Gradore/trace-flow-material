import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Recycle, Loader2, Building2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

const loginSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
  password: z.string().min(6, "Passwort muss mindestens 6 Zeichen haben"),
});

const signupSchema = z.object({
  name: z.string().min(2, "Name muss mindestens 2 Zeichen haben"),
  email: z.string().email("Ungültige E-Mail-Adresse"),
  password: z.string().min(6, "Passwort muss mindestens 6 Zeichen haben"),
  confirmPassword: z.string(),
  role: z.enum(['customer', 'supplier', 'logistics']),
  companyName: z.string().min(2, "Firmenname muss mindestens 2 Zeichen haben"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwörter stimmen nicht überein",
  path: ["confirmPassword"],
});

type RequestedRole = 'customer' | 'supplier' | 'logistics';

const roleLabels: Record<RequestedRole, string> = {
  customer: 'Kunde',
  supplier: 'Lieferant',
  logistics: 'Logistiker',
};

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [signupRole, setSignupRole] = useState<RequestedRole>('customer');
  const [signupCompanyName, setSignupCompanyName] = useState("");
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect if already logged in
  if (user) {
    navigate("/", { replace: true });
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    const validation = loginSchema.safeParse({ email: loginEmail, password: loginPassword });
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[`login_${err.path[0]}`] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setIsLoading(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Anmeldung fehlgeschlagen",
        description: error.message === "Invalid login credentials" 
          ? "Ungültige E-Mail oder Passwort" 
          : error.message,
      });
      return;
    }

    navigate("/");
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validation = signupSchema.safeParse({
      name: signupName,
      email: signupEmail,
      password: signupPassword,
      confirmPassword: signupConfirmPassword,
      role: signupRole,
      companyName: signupCompanyName,
    });
    
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[`signup_${err.path[0]}`] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    
    // First, create the user with Supabase Auth
    const { error: authError } = await signUp(signupEmail, signupPassword, signupName);
    
    if (authError) {
      setIsLoading(false);
      if (authError.message.includes("already registered")) {
        toast({
          variant: "destructive",
          title: "Registrierung fehlgeschlagen",
          description: "Diese E-Mail-Adresse ist bereits registriert.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Registrierung fehlgeschlagen",
          description: authError.message,
        });
      }
      return;
    }

    // Get the newly created user
    const { data: { user: newUser } } = await supabase.auth.getUser();
    
    if (newUser) {
      // Create pending registration
      const { error: regError } = await supabase
        .from('pending_registrations')
        .insert({
          user_id: newUser.id,
          email: signupEmail,
          name: signupName,
          requested_role: signupRole,
          company_name: signupCompanyName,
          status: 'pending',
        });

      if (regError) {
        console.error('Error creating pending registration:', regError);
      }
    }

    setIsLoading(false);
    setRegistrationSuccess(true);
    
    toast({
      title: "Registrierung eingereicht",
      description: "Ihre Registrierung wird von einem Administrator geprüft.",
    });

    // Sign out the user since they need approval first
    await supabase.auth.signOut();
  };

  if (registrationSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Recycle className="h-6 w-6 text-primary" />
              </div>
              <span className="text-2xl font-bold">RecyTrack</span>
            </div>
            <CardTitle>Registrierung erfolgreich</CardTitle>
            <CardDescription>
              Ihre Registrierung wurde eingereicht
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Ihre Registrierung als <strong>{roleLabels[signupRole]}</strong> für die Firma <strong>{signupCompanyName}</strong> wurde eingereicht. 
                Ein Administrator wird Ihre Anfrage prüfen und Sie per E-Mail benachrichtigen, sobald Ihr Konto aktiviert wurde.
              </AlertDescription>
            </Alert>
            <Button 
              className="w-full" 
              variant="outline"
              onClick={() => {
                setRegistrationSuccess(false);
                setSignupName("");
                setSignupEmail("");
                setSignupPassword("");
                setSignupConfirmPassword("");
                setSignupCompanyName("");
              }}
            >
              Zurück zur Anmeldung
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Recycle className="h-6 w-6 text-primary" />
            </div>
            <span className="text-2xl font-bold">RecyTrack</span>
          </div>
          <CardTitle>Willkommen</CardTitle>
          <CardDescription>
            Materialfluss-Tracking für die Recycling-Industrie
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Anmelden</TabsTrigger>
              <TabsTrigger value="signup">Registrieren</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">E-Mail</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="name@firma.de"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    disabled={isLoading}
                  />
                  {errors.login_email && (
                    <p className="text-sm text-destructive">{errors.login_email}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Passwort</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    disabled={isLoading}
                  />
                  {errors.login_password && (
                    <p className="text-sm text-destructive">{errors.login_password}</p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Anmelden
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Max Mustermann"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    disabled={isLoading}
                  />
                  {errors.signup_name && (
                    <p className="text-sm text-destructive">{errors.signup_name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">E-Mail</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="name@firma.de"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    disabled={isLoading}
                  />
                  {errors.signup_email && (
                    <p className="text-sm text-destructive">{errors.signup_email}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-role">Rolle</Label>
                  <Select value={signupRole} onValueChange={(val) => setSignupRole(val as RequestedRole)} disabled={isLoading}>
                    <SelectTrigger>
                      <SelectValue placeholder="Rolle auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">Kunde</SelectItem>
                      <SelectItem value="supplier">Lieferant</SelectItem>
                      <SelectItem value="logistics">Logistiker</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.signup_role && (
                    <p className="text-sm text-destructive">{errors.signup_role}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-company">Firmenname</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-company"
                      type="text"
                      placeholder="Musterfirma GmbH"
                      value={signupCompanyName}
                      onChange={(e) => setSignupCompanyName(e.target.value)}
                      disabled={isLoading}
                      className="pl-10"
                    />
                  </div>
                  {errors.signup_companyName && (
                    <p className="text-sm text-destructive">{errors.signup_companyName}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Passwort</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    disabled={isLoading}
                  />
                  {errors.signup_password && (
                    <p className="text-sm text-destructive">{errors.signup_password}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm">Passwort bestätigen</Label>
                  <Input
                    id="signup-confirm"
                    type="password"
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    disabled={isLoading}
                  />
                  {errors.signup_confirmPassword && (
                    <p className="text-sm text-destructive">{errors.signup_confirmPassword}</p>
                  )}
                </div>
                
                <Alert className="bg-muted">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Ihre Registrierung muss von einem Administrator genehmigt werden, bevor Sie sich anmelden können.
                  </AlertDescription>
                </Alert>
                
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Registrierung einreichen
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
