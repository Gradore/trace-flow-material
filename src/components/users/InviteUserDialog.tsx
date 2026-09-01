import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Eye, EyeOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const roles = [
  { value: "admin", label: "Administrator" },
  { value: "betriebsleiter", label: "Betriebsleiter" },
  { value: "intake", label: "Annahme" },
  { value: "production", label: "Produktion" },
  { value: "qa", label: "QA / Labor" },
  { value: "customer", label: "Kunde" },
  { value: "supplier", label: "Lieferant" },
  { value: "logistics", label: "Logistik" },
];

const generatePassword = () => {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars.charAt(b % chars.length)).join("");
};

export function InviteUserDialog({ open, onOpenChange, onSuccess }: InviteUserDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    name: "",
    password: "",
    role: "customer",
    companyId: "",
  });

  const isExternalRole = ["customer", "supplier", "logistics"].includes(formData.role);

  const { data: companies = [] } = useQuery({
    queryKey: ["companies", "for-invite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, type")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleGeneratePassword = () => {
    const newPassword = generatePassword();
    setFormData({ ...formData, password: newPassword });
    setShowPassword(true);
    toast({
      title: "Passwort generiert",
      description: "Ein sicheres Passwort wurde erstellt. Bitte notieren Sie es.",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username || !formData.name || !formData.password) {
      toast({
        title: "Fehler",
        description: "Bitte Benutzername, Name und Passwort ausfüllen.",
        variant: "destructive",
      });
      return;
    }

    if (!/^[a-z0-9._-]+$/i.test(formData.username)) {
      toast({
        title: "Fehler",
        description: "Benutzername darf nur Buchstaben, Zahlen, Punkte, Unterstriche und Bindestriche enthalten.",
        variant: "destructive",
      });
      return;
    }

    if (formData.password.length < 8) {
      toast({
        title: "Fehler",
        description: "Passwort muss mindestens 8 Zeichen lang sein.",
        variant: "destructive",
      });
      return;
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast({
        title: "Fehler",
        description: "Ungültige E-Mail-Adresse.",
        variant: "destructive",
      });
      return;
    }

    if (isExternalRole && !formData.companyId) {
      toast({
        title: "Fehler",
        description: "Für Kunde, Lieferant und Logistiker ist eine Firmenzuordnung erforderlich.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // The user is created server-side with the service role. Creating it from
      // the browser with supabase.auth.signUp() would replace the admin's own
      // session with the new user's session.
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          username: formData.username.toLowerCase(),
          email: formData.email || null,
          name: formData.name,
          password: formData.password,
          role: formData.role,
          companyId: formData.companyId || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Benutzer angelegt",
        description: data?.warning
          ? data.warning
          : `${formData.name} (@${formData.username.toLowerCase()}) wurde erfolgreich angelegt.`,
        variant: data?.warning ? "destructive" : "default",
      });

      setFormData({ username: "", email: "", name: "", password: "", role: "customer", companyId: "" });
      setShowPassword(false);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast({
        title: "Fehler beim Anlegen",
        description: error.message || "Ein unbekannter Fehler ist aufgetreten.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Neuen Benutzer anlegen</DialogTitle>
          <DialogDescription>
            Erstellen Sie einen neuen Benutzer mit Benutzername, Passwort und Rolle. E-Mail ist optional.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Max Mustermann"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="username">Benutzername *</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value.replace(/\s/g, '') })}
                placeholder="max.mustermann"
              />
              <p className="text-xs text-muted-foreground">Wird für die Anmeldung verwendet</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">E-Mail (optional)</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="max@beispiel.de"
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Passwort *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto py-1 px-2 text-xs"
                  onClick={handleGeneratePassword}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Generieren
                </Button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mindestens 8 Zeichen"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {formData.password && (
                <p className="text-xs text-muted-foreground">
                  {showPassword ? "Passwort ist sichtbar" : "Klicken Sie auf das Auge, um das Passwort anzuzeigen"}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Rolle *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Rolle auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isExternalRole && (
              <div className="grid gap-2">
                <Label htmlFor="company">Firma *</Label>
                <Select
                  value={formData.companyId}
                  onValueChange={(value) => setFormData({ ...formData, companyId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Firma auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Externe Rollen sehen nur die Daten ihrer Firma.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Benutzer anlegen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
