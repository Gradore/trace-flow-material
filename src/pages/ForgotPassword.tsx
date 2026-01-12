import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Recycle, Loader2, Info, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate email
    if (!email || !z.string().email().safeParse(email).success) {
      toast({
        variant: "destructive",
        title: "Ungültige E-Mail",
        description: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      // Always show success message to prevent user enumeration
      setEmailSent(true);
      
      if (error) {
        // Log error for debugging but don't show to user
        console.error("Password reset error:", error);
      }
    } catch (err) {
      console.error("Password reset error:", err);
      // Still show success message for security
      setEmailSent(true);
    } finally {
      setIsLoading(false);
    }
  };

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
          <CardTitle>Passwort zurücksetzen</CardTitle>
          <CardDescription>
            {emailSent 
              ? "E-Mail wurde gesendet" 
              : "Geben Sie Ihre E-Mail-Adresse ein, um Ihr Passwort zurückzusetzen"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {emailSent ? (
            <>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Wenn ein Konto mit der E-Mail <strong>{email}</strong> existiert, 
                  erhalten Sie in Kürze einen Link zum Zurücksetzen des Passworts.
                  Bitte überprüfen Sie auch Ihren Spam-Ordner.
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={() => {
                    setEmailSent(false);
                    setEmail("");
                  }}
                >
                  Erneut versuchen
                </Button>
                <Link to="/auth" className="block">
                  <Button className="w-full" variant="ghost">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Zurück zur Anmeldung
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail-Adresse</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@firma.de"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Link zum Zurücksetzen senden
              </Button>
              <Link to="/auth" className="block">
                <Button type="button" className="w-full" variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Zurück zur Anmeldung
                </Button>
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
