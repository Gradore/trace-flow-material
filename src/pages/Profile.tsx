import { useState } from "react";
import { User, Mail, Lock, Save, Loader2, Download, FileJson } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

export default function Profile() {
  const { user } = useAuth();
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const { data: profile, refetch } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      
      if (error) throw error;
      if (data) setName(data.name);
      return data;
    },
    enabled: !!user,
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleUpdateProfile = async () => {
    if (!user || !name.trim()) return;
    
    setIsUpdatingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ name: name.trim() })
        .eq("user_id", user.id);
      
      if (error) throw error;
      
      toast({ title: "Profil aktualisiert" });
      refetch();
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "Fehler", description: "Passwörter stimmen nicht überein", variant: "destructive" });
      return;
    }
    
    if (newPassword.length < 6) {
      toast({ title: "Fehler", description: "Passwort muss mindestens 6 Zeichen haben", variant: "destructive" });
      return;
    }
    
    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      
      if (error) throw error;
      
      toast({ title: "Passwort geändert" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleGdprExport = async () => {
    setIsExporting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error("Nicht angemeldet");

      const { data, error } = await supabase.functions.invoke('gdpr-export', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      // Download the JSON file
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || `dsgvo-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: "Export erfolgreich", description: "Ihre Daten wurden heruntergeladen" });
    } catch (error: any) {
      toast({ title: "Export fehlgeschlagen", description: error.message, variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mein Profil</h1>
        <p className="text-muted-foreground mt-1">Persönliche Einstellungen verwalten</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profildaten
          </CardTitle>
          <CardDescription>Aktualisiere deinen Namen und andere Informationen</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary/10 text-primary text-xl">
                {profile?.name ? getInitials(profile.name) : "?"}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-foreground">{profile?.name || "Laden..."}</p>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dein Name"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              value={profile?.email || ""}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">E-Mail kann nicht geändert werden</p>
          </div>
          
          <Button onClick={handleUpdateProfile} disabled={isUpdatingProfile}>
            {isUpdatingProfile ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Speichern
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Passwort ändern
          </CardTitle>
          <CardDescription>Aktualisiere dein Passwort für mehr Sicherheit</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">Neues Passwort</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mindestens 6 Zeichen"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Passwort wiederholen"
            />
          </div>
          
          <Button onClick={handleUpdatePassword} disabled={isUpdatingPassword || !newPassword}>
            {isUpdatingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
            Passwort ändern
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5" />
            Datenschutz (DSGVO)
          </CardTitle>
          <CardDescription>
            Exportiere alle über dich gespeicherten Daten gemäß Art. 15 DSGVO
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Du hast das Recht, eine Kopie aller personenbezogenen Daten zu erhalten, 
            die wir über dich gespeichert haben. Der Export enthält dein Profil, 
            Rollen, Aktivitäten und alle zugehörigen Datensätze.
          </p>
          <Button onClick={handleGdprExport} disabled={isExporting} variant="outline">
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Meine Daten exportieren (JSON)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
