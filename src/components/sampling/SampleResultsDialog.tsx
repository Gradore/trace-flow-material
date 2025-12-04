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
import { FlaskConical, Upload, FileText, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SampleResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sample: {
    id: string;
    batch: string;
    material: string;
    processStep: string;
    sampler: string;
    date: string;
    status: string;
  } | null;
}

const mockResults = {
  fiberLength: "12.5 mm",
  purity: "94.2%",
  resinRatio: "35%",
  density: "1.85 g/cm³",
  moisture: "0.8%",
  sievingFraction: "< 2mm: 15%, 2-5mm: 45%, > 5mm: 40%",
};

const mockDocuments = [
  { name: "Laborprotokoll_PRB-2024-0154.pdf", type: "lab_report", date: "2024-12-02" },
  { name: "Foto_Probe_1.jpg", type: "photo", date: "2024-12-02" },
];

export function SampleResultsDialog({ open, onOpenChange, sample }: SampleResultsDialogProps) {
  if (!sample) return null;

  const statusConfig = {
    pending: { label: "Ausstehend", class: "status-badge-warning" },
    in_analysis: { label: "In Analyse", class: "status-badge-info" },
    approved: { label: "Freigegeben", class: "status-badge-success" },
    rejected: { label: "Abgelehnt", class: "status-badge-destructive" },
  };

  const status = statusConfig[sample.status as keyof typeof statusConfig];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            {sample.id}
            <span className={cn(status.class, "ml-2")}>{status.label}</span>
          </DialogTitle>
          <DialogDescription>
            Charge: {sample.batch} • Material: {sample.material} • {sample.processStep}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="results" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="results">Ergebnisse</TabsTrigger>
            <TabsTrigger value="documents">Dokumente</TabsTrigger>
            <TabsTrigger value="info">Info</TabsTrigger>
          </TabsList>

          <TabsContent value="results" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Faserlänge</Label>
                <Input value={mockResults.fiberLength} readOnly className="bg-secondary/30" />
              </div>
              <div className="space-y-2">
                <Label>Reinheit</Label>
                <Input value={mockResults.purity} readOnly className="bg-secondary/30" />
              </div>
              <div className="space-y-2">
                <Label>Harzanteil</Label>
                <Input value={mockResults.resinRatio} readOnly className="bg-secondary/30" />
              </div>
              <div className="space-y-2">
                <Label>Dichte</Label>
                <Input value={mockResults.density} readOnly className="bg-secondary/30" />
              </div>
              <div className="space-y-2">
                <Label>Feuchtigkeit</Label>
                <Input value={mockResults.moisture} readOnly className="bg-secondary/30" />
              </div>
              <div className="space-y-2">
                <Label>Siebfraktion</Label>
                <Input value={mockResults.sievingFraction} readOnly className="bg-secondary/30" />
              </div>
            </div>

            {sample.status === "in_analysis" && (
              <div className="flex items-center gap-2 pt-4 border-t border-border">
                <Button variant="success" className="flex-1">
                  <CheckCircle className="h-4 w-4" />
                  Freigeben
                </Button>
                <Button variant="destructive" className="flex-1">
                  <XCircle className="h-4 w-4" />
                  Ablehnen
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="documents" className="space-y-4 mt-4">
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">Dokumente hochladen</p>
              <p className="text-xs text-muted-foreground mt-1">
                Laborberichte, Fotos oder CSV-Daten
              </p>
              <Button variant="outline" size="sm" className="mt-4">
                <Upload className="h-4 w-4 mr-2" />
                Datei wählen
              </Button>
            </div>

            <div className="space-y-2">
              {mockDocuments.map((doc, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                  <FileText className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">{doc.date}</p>
                  </div>
                  <Button variant="ghost" size="sm">
                    Öffnen
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="info" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Proben-ID</Label>
                <p className="font-mono font-medium">{sample.id}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Charge</Label>
                <p className="font-mono font-medium">{sample.batch}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Material</Label>
                <p className="font-medium">{sample.material}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Prozessschritt</Label>
                <p className="font-medium">{sample.processStep}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Probenehmer</Label>
                <p className="font-medium">{sample.sampler}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Datum</Label>
                <p className="font-medium">{new Date(sample.date).toLocaleDateString("de-DE")}</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
