import { useState } from "react";
import { Settings, Users, Shield, Bell, Mail, Database, Save, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";

interface AdminSettingsConfig {
  // General Settings
  companyName: string;
  companyEmail: string;
  defaultLanguage: string;
  
  // User Settings
  allowSelfRegistration: boolean;
  requireEmailVerification: boolean;
  defaultRole: string;
  sessionTimeoutMinutes: number;
  maxLoginAttempts: number;
  
  // Notification Settings
  emailNotificationsEnabled: boolean;
  notifyOnNewRegistration: boolean;
  notifyOnOrderChange: boolean;
  notifyOnSampleApproval: boolean;
  notifyOnDeadlineApproaching: boolean;
  deadlineWarningDays: number;
  
  // Security Settings
  enforceStrongPasswords: boolean;
  minPasswordLength: number;
  requireTwoFactor: boolean;
  ipWhitelistEnabled: boolean;
  ipWhitelist: string;
  
  // System Settings
  dataRetentionDays: number;
  auditLogRetentionDays: number;
  autoBackupEnabled: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
}

const defaultSettings: AdminSettingsConfig = {
  companyName: "LAUREKU RecyTrack",
  companyEmail: "info@laureku.de",
  defaultLanguage: "de",
  
  allowSelfRegistration: true,
  requireEmailVerification: true,
  defaultRole: "customer",
  sessionTimeoutMinutes: 480,
  maxLoginAttempts: 5,
  
  emailNotificationsEnabled: true,
  notifyOnNewRegistration: true,
  notifyOnOrderChange: true,
  notifyOnSampleApproval: true,
  notifyOnDeadlineApproaching: true,
  deadlineWarningDays: 3,
  
  enforceStrongPasswords: true,
  minPasswordLength: 8,
  requireTwoFactor: false,
  ipWhitelistEnabled: false,
  ipWhitelist: "",
  
  dataRetentionDays: 365,
  auditLogRetentionDays: 730,
  autoBackupEnabled: true,
  maintenanceMode: false,
  maintenanceMessage: "Das System wird gewartet. Bitte versuche es später erneut.",
};

export default function AdminSettings() {
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const [settings, setSettings] = useState<AdminSettingsConfig>(() => {
    const saved = localStorage.getItem("admin_settings");
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });
  const [isSaving, setIsSaving] = useState(false);

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const updateSetting = <K extends keyof AdminSettingsConfig>(key: K, value: AdminSettingsConfig[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      localStorage.setItem("admin_settings", JSON.stringify(settings));
      toast({ title: "Einstellungen gespeichert", description: "Alle Änderungen wurden übernommen." });
    } catch (error) {
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaults = () => {
    setSettings(defaultSettings);
    toast({ title: "Zurückgesetzt", description: "Alle Einstellungen wurden auf Standardwerte zurückgesetzt." });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin-Einstellungen</h1>
          <p className="text-muted-foreground mt-1">Systemweite Konfiguration für alle Mitarbeiter</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetToDefaults}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Zurücksetzen
          </Button>
          <Button onClick={saveSettings} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Speichern
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="general" className="gap-2">
            <Settings className="h-4 w-4" />
            Allgemein
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Benutzer
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Benachrichtigungen
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            Sicherheit
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-2">
            <Database className="h-4 w-4" />
            System
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Allgemeine Einstellungen</CardTitle>
              <CardDescription>Grundlegende Unternehmenskonfiguration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Firmenname</Label>
                  <Input
                    id="companyName"
                    value={settings.companyName}
                    onChange={(e) => updateSetting("companyName", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyEmail">Firmen-E-Mail</Label>
                  <Input
                    id="companyEmail"
                    type="email"
                    value={settings.companyEmail}
                    onChange={(e) => updateSetting("companyEmail", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultLanguage">Standardsprache</Label>
                <Select value={settings.defaultLanguage} onValueChange={(v) => updateSetting("defaultLanguage", v)}>
                  <SelectTrigger id="defaultLanguage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="en">Englisch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Settings */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Benutzereinstellungen</CardTitle>
              <CardDescription>Registrierung und Zugangskontrolle für Mitarbeiter</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Selbstregistrierung erlauben</Label>
                  <p className="text-sm text-muted-foreground">
                    Neue Benutzer können sich selbst registrieren
                  </p>
                </div>
                <Switch
                  checked={settings.allowSelfRegistration}
                  onCheckedChange={(v) => updateSetting("allowSelfRegistration", v)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>E-Mail-Verifizierung erforderlich</Label>
                  <p className="text-sm text-muted-foreground">
                    Benutzer müssen ihre E-Mail-Adresse bestätigen
                  </p>
                </div>
                <Switch
                  checked={settings.requireEmailVerification}
                  onCheckedChange={(v) => updateSetting("requireEmailVerification", v)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="defaultRole">Standard-Rolle für neue Benutzer</Label>
                <Select value={settings.defaultRole} onValueChange={(v) => updateSetting("defaultRole", v)}>
                  <SelectTrigger id="defaultRole">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Kunde</SelectItem>
                    <SelectItem value="supplier">Lieferant</SelectItem>
                    <SelectItem value="logistics">Logistik</SelectItem>
                    <SelectItem value="intake">Annahme</SelectItem>
                    <SelectItem value="production">Produktion</SelectItem>
                    <SelectItem value="qa">QA/Labor</SelectItem>
                    <SelectItem value="betriebsleiter">Betriebsleiter</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sessionTimeout">Sitzungs-Timeout (Minuten)</Label>
                  <Input
                    id="sessionTimeout"
                    type="number"
                    value={settings.sessionTimeoutMinutes}
                    onChange={(e) => updateSetting("sessionTimeoutMinutes", parseInt(e.target.value) || 480)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxLoginAttempts">Max. Login-Versuche</Label>
                  <Input
                    id="maxLoginAttempts"
                    type="number"
                    value={settings.maxLoginAttempts}
                    onChange={(e) => updateSetting("maxLoginAttempts", parseInt(e.target.value) || 5)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Benachrichtigungseinstellungen</CardTitle>
              <CardDescription>E-Mail- und System-Benachrichtigungen konfigurieren</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>E-Mail-Benachrichtigungen aktiviert</Label>
                  <p className="text-sm text-muted-foreground">
                    Globaler Schalter für alle E-Mail-Benachrichtigungen
                  </p>
                </div>
                <Switch
                  checked={settings.emailNotificationsEnabled}
                  onCheckedChange={(v) => updateSetting("emailNotificationsEnabled", v)}
                />
              </div>

              <div className="border-t border-border pt-4 space-y-4">
                <h4 className="font-medium">Benachrichtigungsereignisse</h4>
                
                <div className="flex items-center justify-between">
                  <Label>Neue Registrierungen</Label>
                  <Switch
                    checked={settings.notifyOnNewRegistration}
                    onCheckedChange={(v) => updateSetting("notifyOnNewRegistration", v)}
                    disabled={!settings.emailNotificationsEnabled}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label>Auftragsänderungen</Label>
                  <Switch
                    checked={settings.notifyOnOrderChange}
                    onCheckedChange={(v) => updateSetting("notifyOnOrderChange", v)}
                    disabled={!settings.emailNotificationsEnabled}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label>Proben-Freigaben</Label>
                  <Switch
                    checked={settings.notifyOnSampleApproval}
                    onCheckedChange={(v) => updateSetting("notifyOnSampleApproval", v)}
                    disabled={!settings.emailNotificationsEnabled}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label>Nahende Deadlines</Label>
                  <Switch
                    checked={settings.notifyOnDeadlineApproaching}
                    onCheckedChange={(v) => updateSetting("notifyOnDeadlineApproaching", v)}
                    disabled={!settings.emailNotificationsEnabled}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deadlineWarningDays">Deadline-Warnung (Tage vorher)</Label>
                <Input
                  id="deadlineWarningDays"
                  type="number"
                  value={settings.deadlineWarningDays}
                  onChange={(e) => updateSetting("deadlineWarningDays", parseInt(e.target.value) || 3)}
                  disabled={!settings.notifyOnDeadlineApproaching}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Sicherheitseinstellungen</CardTitle>
              <CardDescription>Passwort- und Zugriffsrichtlinien</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Starke Passwörter erzwingen</Label>
                  <p className="text-sm text-muted-foreground">
                    Erfordert Groß-/Kleinbuchstaben, Zahlen und Sonderzeichen
                  </p>
                </div>
                <Switch
                  checked={settings.enforceStrongPasswords}
                  onCheckedChange={(v) => updateSetting("enforceStrongPasswords", v)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="minPasswordLength">Mindest-Passwortlänge</Label>
                <Input
                  id="minPasswordLength"
                  type="number"
                  min={6}
                  max={32}
                  value={settings.minPasswordLength}
                  onChange={(e) => updateSetting("minPasswordLength", parseInt(e.target.value) || 8)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Zwei-Faktor-Authentifizierung erforderlich</Label>
                  <p className="text-sm text-muted-foreground">
                    Alle Benutzer müssen 2FA aktivieren
                  </p>
                </div>
                <Switch
                  checked={settings.requireTwoFactor}
                  onCheckedChange={(v) => updateSetting("requireTwoFactor", v)}
                />
              </div>

              <div className="border-t border-border pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>IP-Whitelist aktivieren</Label>
                    <p className="text-sm text-muted-foreground">
                      Nur bestimmte IP-Adressen zulassen
                    </p>
                  </div>
                  <Switch
                    checked={settings.ipWhitelistEnabled}
                    onCheckedChange={(v) => updateSetting("ipWhitelistEnabled", v)}
                  />
                </div>

                {settings.ipWhitelistEnabled && (
                  <div className="space-y-2">
                    <Label htmlFor="ipWhitelist">Erlaubte IP-Adressen (eine pro Zeile)</Label>
                    <Textarea
                      id="ipWhitelist"
                      value={settings.ipWhitelist}
                      onChange={(e) => updateSetting("ipWhitelist", e.target.value)}
                      placeholder="192.168.1.1&#10;10.0.0.0/24"
                      rows={4}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Settings */}
        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle>Systemeinstellungen</CardTitle>
              <CardDescription>Datenhaltung und Wartung</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dataRetentionDays">Datenaufbewahrung (Tage)</Label>
                  <Input
                    id="dataRetentionDays"
                    type="number"
                    value={settings.dataRetentionDays}
                    onChange={(e) => updateSetting("dataRetentionDays", parseInt(e.target.value) || 365)}
                  />
                  <p className="text-xs text-muted-foreground">Wie lange Daten aufbewahrt werden</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="auditLogRetentionDays">Audit-Log Aufbewahrung (Tage)</Label>
                  <Input
                    id="auditLogRetentionDays"
                    type="number"
                    value={settings.auditLogRetentionDays}
                    onChange={(e) => updateSetting("auditLogRetentionDays", parseInt(e.target.value) || 730)}
                  />
                  <p className="text-xs text-muted-foreground">Wie lange Audit-Logs gespeichert werden</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Automatische Backups</Label>
                  <p className="text-sm text-muted-foreground">
                    Tägliche Sicherung aller Daten
                  </p>
                </div>
                <Switch
                  checked={settings.autoBackupEnabled}
                  onCheckedChange={(v) => updateSetting("autoBackupEnabled", v)}
                />
              </div>

              <div className="border-t border-border pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Wartungsmodus</Label>
                    <p className="text-sm text-muted-foreground">
                      System für Nicht-Admins sperren
                    </p>
                  </div>
                  <Switch
                    checked={settings.maintenanceMode}
                    onCheckedChange={(v) => updateSetting("maintenanceMode", v)}
                  />
                </div>

                {settings.maintenanceMode && (
                  <div className="space-y-2">
                    <Label htmlFor="maintenanceMessage">Wartungsmeldung</Label>
                    <Textarea
                      id="maintenanceMessage"
                      value={settings.maintenanceMessage}
                      onChange={(e) => updateSetting("maintenanceMessage", e.target.value)}
                      rows={2}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
