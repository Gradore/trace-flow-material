import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Inbox, Upload, Camera, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface IntakeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IntakeDialog({ open, onOpenChange }: IntakeDialogProps) {
  const [formData, setFormData] = useState({
    supplier: "",
    materialType: "",
    resinType: "",
    weight: "",
    wasteCode: "",
    container: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Materialeingang erstellt:", formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-primary" />
            Neuen Materialeingang erfassen
          </DialogTitle>
          <DialogDescription>
            Erfassen Sie eingehendes Material mit allen relevanten Dokumenten.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basisdaten</TabsTrigger>
            <TabsTrigger value="material">Material</TabsTrigger>
            <TabsTrigger value="documents">Dokumente</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="supplier">Lieferant</Label>
              <Input
                id="supplier"
                placeholder="z.B. Recycling GmbH"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weight">Gewicht (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  placeholder="z.B. 2500"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wasteCode">Abfallschlüssel</Label>
                <Input
                  id="wasteCode"
                  placeholder="z.B. 07 02 13"
                  value={formData.wasteCode}
                  onChange={(e) => setFormData({ ...formData, wasteCode: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="container">Container zuweisen</Label>
              <Select
                value={formData.container}
                onValueChange={(value) => setFormData({ ...formData, container: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Container wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BB-2024-0234">BB-2024-0234 (Leer)</SelectItem>
                  <SelectItem value="BB-2024-0232">BB-2024-0232 (Leer)</SelectItem>
                  <SelectItem value="GX-2024-0156">GX-2024-0156 (Leer)</SelectItem>
                  <SelectItem value="new">+ Neuen Container erstellen</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="material" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Materialart</Label>
              <Select
                value={formData.materialType}
                onValueChange={(value) => setFormData({ ...formData, materialType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Materialart wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gfk">GFK (Glasfaserverstärkter Kunststoff)</SelectItem>
                  <SelectItem value="pp">Polypropylen (PP)</SelectItem>
                  <SelectItem value="pa">Polyamid (PA)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.materialType === "gfk" && (
              <div className="space-y-2">
                <Label>Harztyp</Label>
                <Select
                  value={formData.resinType}
                  onValueChange={(value) => setFormData({ ...formData, resinType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Harztyp wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="up">UP (Ungesättigter Polyester)</SelectItem>
                    <SelectItem value="ep">EP (Epoxid)</SelectItem>
                    <SelectItem value="ve">VE (Vinylester)</SelectItem>
                    <SelectItem value="pu">PU (Polyurethan)</SelectItem>
                    <SelectItem value="pet">PET</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.materialType === "pa" && (
              <div className="space-y-2">
                <Label>PA-Typ</Label>
                <Select
                  value={formData.resinType}
                  onValueChange={(value) => setFormData({ ...formData, resinType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="PA-Typ wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pa6">PA6</SelectItem>
                    <SelectItem value="pa66">PA66</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </TabsContent>

          <TabsContent value="documents" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">REACH-Dokumente</p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF oder Bilder hochladen
                </p>
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button variant="outline" size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    Datei wählen
                  </Button>
                  <Button variant="outline" size="sm">
                    <Camera className="h-4 w-4 mr-2" />
                    Foto aufnehmen
                  </Button>
                </div>
              </div>

              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">Lieferschein</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Lieferschein hochladen oder automatisch generieren
                </p>
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button variant="outline" size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    Hochladen
                  </Button>
                  <Button variant="outline" size="sm">
                    <FileText className="h-4 w-4 mr-2" />
                    Generieren
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit}>
            Eingang erfassen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
