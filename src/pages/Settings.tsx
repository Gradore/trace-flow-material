import { useState } from "react";
import { Save, Plus, Trash2, Eye, EyeOff, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";

interface FieldConfig {
  id: string;
  name: string;
  label: string;
  required: boolean;
  visible: boolean;
  custom?: boolean;
}

const defaultIntakeFields: FieldConfig[] = [
  { id: "supplier", name: "supplier", label: "Lieferant", required: true, visible: true },
  { id: "material_type", name: "material_type", label: "Materialart", required: true, visible: true },
  { id: "material_subtype", name: "material_subtype", label: "Untertyp", required: false, visible: true },
  { id: "weight_kg", name: "weight_kg", label: "Gewicht (kg)", required: true, visible: true },
  { id: "waste_code", name: "waste_code", label: "Abfallschlüssel", required: false, visible: true },
  { id: "notes", name: "notes", label: "Bemerkungen", required: false, visible: true },
];

const defaultContainerFields: FieldConfig[] = [
  { id: "type", name: "type", label: "Containertyp", required: true, visible: true },
  { id: "location", name: "location", label: "Standort", required: false, visible: true },
  { id: "volume_liters", name: "volume_liters", label: "Volumen (Liter)", required: false, visible: true },
];

const defaultProcessingFields: FieldConfig[] = [
  { id: "step_type", name: "step_type", label: "Verarbeitungsschritt", required: true, visible: true },
  { id: "notes", name: "notes", label: "Bemerkungen", required: false, visible: true },
];

const defaultSamplingFields: FieldConfig[] = [
  { id: "sampler_name", name: "sampler_name", label: "Probenehmer", required: true, visible: true },
  { id: "notes", name: "notes", label: "Bemerkungen", required: false, visible: true },
];

/**
 * A corrupt localStorage entry must not take the whole page down, so the read
 * always falls back to the defaults.
 */
const loadFields = (storageKey: string, fallback: FieldConfig[]): FieldConfig[] => {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as FieldConfig[]) : fallback;
  } catch (error) {
    console.error(`Invalid field configuration in ${storageKey}:`, error);
    return fallback;
  }
};

interface FieldEditorProps {
  title: string;
  fields: FieldConfig[];
  onChange: (fields: FieldConfig[]) => void;
}

/**
 * Declared at module scope on purpose: a component defined inside Settings gets
 * a new identity on every render, which remounts the inputs and steals the
 * focus after each keystroke.
 */
function FieldEditor({ title, fields, onChange }: FieldEditorProps) {
  const [newFieldName, setNewFieldName] = useState("");

  const updateField = (fieldId: string, updates: Partial<FieldConfig>) => {
    onChange(fields.map(f => (f.id === fieldId ? { ...f, ...updates } : f)));
  };

  const addCustomField = () => {
    const label = newFieldName.trim();
    if (!label) return;

    const newField: FieldConfig = {
      id: `custom_${Date.now()}`,
      name: label.toLowerCase().replace(/\s+/g, "_"),
      label,
      required: false,
      visible: true,
      custom: true,
    };

    onChange([...fields, newField]);
    setNewFieldName("");
  };

  const removeField = (fieldId: string) => {
    onChange(fields.filter(f => f.id !== fieldId));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Felder umbenennen, ein-/ausblenden oder als Pflichtfeld markieren</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map((field) => (
          <div key={field.id} className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30">
            <div className="flex-1">
              <Input
                value={field.label}
                onChange={(e) => updateField(field.id, { label: e.target.value })}
                className="font-medium"
              />
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Pflicht</Label>
              <Switch
                checked={field.required}
                onCheckedChange={(checked) => updateField(field.id, { required: checked })}
              />
            </div>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => updateField(field.id, { visible: !field.visible })}
            >
              {field.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
            </Button>

            {field.custom && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => removeField(field.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        ))}

        <div className="flex items-center gap-2 pt-4 border-t border-border">
          <Input
            placeholder="Neues Feld hinzufügen..."
            value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustomField()}
          />
          <Button variant="outline" onClick={addCustomField}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const [intakeFields, setIntakeFields] = useState<FieldConfig[]>(
    () => loadFields("settings_intake_fields", defaultIntakeFields)
  );

  const [containerFields, setContainerFields] = useState<FieldConfig[]>(
    () => loadFields("settings_container_fields", defaultContainerFields)
  );

  const [processingFields, setProcessingFields] = useState<FieldConfig[]>(
    () => loadFields("settings_processing_fields", defaultProcessingFields)
  );

  const [samplingFields, setSamplingFields] = useState<FieldConfig[]>(
    () => loadFields("settings_sampling_fields", defaultSamplingFields)
  );

  const [isSaving, setIsSaving] = useState(false);

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      localStorage.setItem("settings_intake_fields", JSON.stringify(intakeFields));
      localStorage.setItem("settings_container_fields", JSON.stringify(containerFields));
      localStorage.setItem("settings_processing_fields", JSON.stringify(processingFields));
      localStorage.setItem("settings_sampling_fields", JSON.stringify(samplingFields));

      toast({
        title: "Feldkonfiguration lokal gespeichert",
        description: "Die Konfiguration gilt nur in diesem Browser.",
      });
    } catch {
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Einstellungen</h1>
          <p className="text-muted-foreground mt-1">Feldkonfiguration und Anpassungen</p>
        </div>
        <Button onClick={saveSettings} disabled={isSaving}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Speichern
        </Button>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Nur lokal gespeichert</AlertTitle>
        <AlertDescription>
          Diese Feldkonfiguration wird ausschließlich in diesem Browser abgelegt. Sie wird noch nicht auf die
          Formulare in Materialeingang, Container, Verarbeitung und Probenahme angewendet und ist für andere
          Benutzer nicht sichtbar.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="intake" className="space-y-4">
        <TabsList className="max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="intake">Materialeingang</TabsTrigger>
          <TabsTrigger value="container">Container</TabsTrigger>
          <TabsTrigger value="processing">Verarbeitung</TabsTrigger>
          <TabsTrigger value="sampling">Probenahme</TabsTrigger>
        </TabsList>

        <TabsContent value="intake">
          <FieldEditor fields={intakeFields} onChange={setIntakeFields} title="Materialeingang-Felder" />
        </TabsContent>

        <TabsContent value="container">
          <FieldEditor fields={containerFields} onChange={setContainerFields} title="Container-Felder" />
        </TabsContent>

        <TabsContent value="processing">
          <FieldEditor fields={processingFields} onChange={setProcessingFields} title="Verarbeitungs-Felder" />
        </TabsContent>

        <TabsContent value="sampling">
          <FieldEditor fields={samplingFields} onChange={setSamplingFields} title="Probenahme-Felder" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
