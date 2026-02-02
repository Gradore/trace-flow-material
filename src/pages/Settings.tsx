import { useState } from "react";
import { Save, Plus, Trash2, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export default function Settings() {
  const [intakeFields, setIntakeFields] = useState<FieldConfig[]>(() => {
    const saved = localStorage.getItem("settings_intake_fields");
    return saved ? JSON.parse(saved) : defaultIntakeFields;
  });
  
  const [containerFields, setContainerFields] = useState<FieldConfig[]>(() => {
    const saved = localStorage.getItem("settings_container_fields");
    return saved ? JSON.parse(saved) : defaultContainerFields;
  });
  
  const [processingFields, setProcessingFields] = useState<FieldConfig[]>(() => {
    const saved = localStorage.getItem("settings_processing_fields");
    return saved ? JSON.parse(saved) : defaultProcessingFields;
  });
  
  const [samplingFields, setSamplingFields] = useState<FieldConfig[]>(() => {
    const saved = localStorage.getItem("settings_sampling_fields");
    return saved ? JSON.parse(saved) : defaultSamplingFields;
  });

  const [newFieldName, setNewFieldName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const updateField = (
    fields: FieldConfig[],
    setFields: React.Dispatch<React.SetStateAction<FieldConfig[]>>,
    fieldId: string,
    updates: Partial<FieldConfig>
  ) => {
    setFields(fields.map(f => f.id === fieldId ? { ...f, ...updates } : f));
  };

  const addCustomField = (
    fields: FieldConfig[],
    setFields: React.Dispatch<React.SetStateAction<FieldConfig[]>>
  ) => {
    if (!newFieldName.trim()) return;
    
    const newField: FieldConfig = {
      id: `custom_${Date.now()}`,
      name: newFieldName.toLowerCase().replace(/\s+/g, "_"),
      label: newFieldName,
      required: false,
      visible: true,
      custom: true,
    };
    
    setFields([...fields, newField]);
    setNewFieldName("");
  };

  const removeField = (
    fields: FieldConfig[],
    setFields: React.Dispatch<React.SetStateAction<FieldConfig[]>>,
    fieldId: string
  ) => {
    setFields(fields.filter(f => f.id !== fieldId));
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      localStorage.setItem("settings_intake_fields", JSON.stringify(intakeFields));
      localStorage.setItem("settings_container_fields", JSON.stringify(containerFields));
      localStorage.setItem("settings_processing_fields", JSON.stringify(processingFields));
      localStorage.setItem("settings_sampling_fields", JSON.stringify(samplingFields));
      
      toast({ title: "Einstellungen gespeichert" });
    } catch (error) {
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const FieldEditor = ({ 
    fields, 
    setFields,
    title 
  }: { 
    fields: FieldConfig[]; 
    setFields: React.Dispatch<React.SetStateAction<FieldConfig[]>>;
    title: string;
  }) => (
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
                onChange={(e) => updateField(fields, setFields, field.id, { label: e.target.value })}
                className="font-medium"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Pflicht</Label>
              <Switch
                checked={field.required}
                onCheckedChange={(checked) => updateField(fields, setFields, field.id, { required: checked })}
              />
            </div>
            
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => updateField(fields, setFields, field.id, { visible: !field.visible })}
            >
              {field.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
            </Button>
            
            {field.custom && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => removeField(fields, setFields, field.id)}
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
            onKeyDown={(e) => e.key === "Enter" && addCustomField(fields, setFields)}
          />
          <Button variant="outline" onClick={() => addCustomField(fields, setFields)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Einstellungen</h1>
          <p className="text-muted-foreground mt-1">Feldkonfiguration und Anpassungen</p>
        </div>
        <Button onClick={saveSettings} disabled={isSaving}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Speichern
        </Button>
      </div>

      <Tabs defaultValue="intake" className="space-y-4">
        <TabsList>
          <TabsTrigger value="intake">Materialeingang</TabsTrigger>
          <TabsTrigger value="container">Container</TabsTrigger>
          <TabsTrigger value="processing">Verarbeitung</TabsTrigger>
          <TabsTrigger value="sampling">Probenahme</TabsTrigger>
        </TabsList>

        <TabsContent value="intake">
          <FieldEditor fields={intakeFields} setFields={setIntakeFields} title="Materialeingang-Felder" />
        </TabsContent>

        <TabsContent value="container">
          <FieldEditor fields={containerFields} setFields={setContainerFields} title="Container-Felder" />
        </TabsContent>

        <TabsContent value="processing">
          <FieldEditor fields={processingFields} setFields={setProcessingFields} title="Verarbeitungs-Felder" />
        </TabsContent>

        <TabsContent value="sampling">
          <FieldEditor fields={samplingFields} setFields={setSamplingFields} title="Probenahme-Felder" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
