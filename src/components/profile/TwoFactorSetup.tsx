import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Shield, Smartphone, Loader2, CheckCircle2, AlertCircle, QrCode } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Note: This is a UI preparation for 2FA. Full implementation requires Supabase MFA API.
// When Supabase MFA is enabled for the project, the actual enrollment will work.

export function TwoFactorSetup() {
  const { user } = useAuth();
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);

  const handleEnableClick = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Check if MFA factors exist
      const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
      
      if (factorError) {
        console.error("MFA list error:", factorError);
        toast({
          title: "2FA nicht verfügbar",
          description: "Die Zwei-Faktor-Authentifizierung ist für dieses Projekt noch nicht aktiviert. Bitte kontaktieren Sie den Administrator.",
          variant: "destructive",
        });
        return;
      }

      // Check if already enrolled
      const totpFactor = factors.totp.find(f => f.status === 'verified');
      if (totpFactor) {
        setIsEnabled(true);
        toast({
          title: "2FA bereits aktiv",
          description: "Die Zwei-Faktor-Authentifizierung ist bereits für Ihr Konto aktiviert.",
        });
        return;
      }

      // Enroll new TOTP factor
      const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'RekuFLOW Authenticator'
      });

      if (enrollError) {
        console.error("MFA enroll error:", enrollError);
        throw new Error("2FA Einrichtung fehlgeschlagen: " + enrollError.message);
      }

      setFactorId(enrollData.id);
      setQrCodeUrl(enrollData.totp.qr_code);
      setShowSetupDialog(true);
    } catch (error: any) {
      console.error("2FA setup error:", error);
      toast({
        title: "Fehler bei 2FA-Einrichtung",
        description: error.message || "Bitte versuchen Sie es später erneut.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!factorId || verificationCode.length !== 6) {
      toast({
        title: "Ungültiger Code",
        description: "Bitte geben Sie den 6-stelligen Code aus Ihrer Authenticator-App ein.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Create a challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) {
        throw new Error("Verifizierung fehlgeschlagen: " + challengeError.message);
      }

      // Verify the challenge
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verificationCode,
      });

      if (verifyError) {
        throw new Error("Code ungültig. Bitte überprüfen Sie den Code und versuchen Sie es erneut.");
      }

      setIsEnabled(true);
      setShowSetupDialog(false);
      setVerificationCode("");
      setQrCodeUrl(null);
      setFactorId(null);

      toast({
        title: "2FA aktiviert",
        description: "Die Zwei-Faktor-Authentifizierung wurde erfolgreich für Ihr Konto aktiviert.",
      });
    } catch (error: any) {
      toast({
        title: "Verifizierung fehlgeschlagen",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors?.totp.find(f => f.status === 'verified');
      
      if (totpFactor) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: totpFactor.id });
        if (error) throw error;
      }

      setIsEnabled(false);
      toast({
        title: "2FA deaktiviert",
        description: "Die Zwei-Faktor-Authentifizierung wurde für Ihr Konto deaktiviert.",
      });
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Zwei-Faktor-Authentifizierung</CardTitle>
                <CardDescription>
                  Zusätzliche Sicherheit für Ihr Konto
                </CardDescription>
              </div>
            </div>
            <Badge variant={isEnabled ? "default" : "secondary"} className={isEnabled ? "bg-success text-success-foreground" : ""}>
              {isEnabled ? "Aktiviert" : "Nicht aktiviert"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-secondary/30 border border-border">
            <div className="flex items-start gap-3">
              <Smartphone className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">So funktioniert 2FA:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Laden Sie eine Authenticator-App herunter (z.B. Google Authenticator, Authy)</li>
                  <li>Scannen Sie den angezeigten QR-Code mit der App</li>
                  <li>Geben Sie beim Login den 6-stelligen Code aus der App ein</li>
                </ol>
              </div>
            </div>
          </div>

          {isEnabled ? (
            <div className="flex items-center justify-between p-4 rounded-lg bg-success/10 border border-success/20">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">2FA ist aktiv für Ihr Konto</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleDisable} disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Deaktivieren
              </Button>
            </div>
          ) : (
            <Button onClick={handleEnableClick} disabled={isLoading} className="w-full">
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Shield className="h-4 w-4 mr-2" />
              )}
              2FA aktivieren
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Setup Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              2FA einrichten
            </DialogTitle>
            <DialogDescription>
              Scannen Sie den QR-Code mit Ihrer Authenticator-App und geben Sie den generierten Code ein.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* QR Code Display */}
            <div className="flex justify-center">
              {qrCodeUrl ? (
                <div className="p-4 bg-white rounded-lg">
                  <img src={qrCodeUrl} alt="2FA QR Code" className="w-48 h-48" />
                </div>
              ) : (
                <div className="w-48 h-48 bg-secondary rounded-lg flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Verification Input */}
            <div className="space-y-2">
              <Label htmlFor="verificationCode">Verifizierungscode</Label>
              <Input
                id="verificationCode"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-widest font-mono"
              />
              <p className="text-xs text-muted-foreground text-center">
                Geben Sie den 6-stelligen Code aus Ihrer Authenticator-App ein
              </p>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  setShowSetupDialog(false);
                  setVerificationCode("");
                }}
              >
                Abbrechen
              </Button>
              <Button 
                className="flex-1"
                onClick={handleVerify}
                disabled={verificationCode.length !== 6 || isLoading}
              >
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Verifizieren
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
