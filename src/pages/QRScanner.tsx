import { useState } from "react";
import { QrCode, Camera, Upload, Package, FileText, History, Plus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function QRScanner() {
  const [manualCode, setManualCode] = useState("");
  const [scannedResult, setScannedResult] = useState<{
    type: string;
    id: string;
    data: Record<string, string>;
  } | null>(null);

  const handleManualSearch = () => {
    // Mock result based on manual code
    if (manualCode.startsWith("BB-") || manualCode.startsWith("GX-") || manualCode.startsWith("BX-")) {
      setScannedResult({
        type: "container",
        id: manualCode,
        data: {
          typ: "BigBag",
          material: "GFK-UP",
          gewicht: "450 kg",
          standort: "Halle A, Regal 12",
          status: "Voll",
        },
      });
    } else if (manualCode.startsWith("ME-")) {
      setScannedResult({
        type: "intake",
        id: manualCode,
        data: {
          lieferant: "Recycling GmbH",
          material: "GFK-UP",
          gewicht: "2500 kg",
          datum: "03.12.2024",
          status: "Eingegangen",
        },
      });
    } else {
      setScannedResult(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">QR-Scanner</h1>
          <p className="text-muted-foreground mt-1">Container oder Material per QR-Code aufrufen</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scanner Area */}
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">QR-Code scannen</h2>
          
          <div className="relative aspect-square max-w-md mx-auto rounded-xl bg-secondary/30 border-2 border-dashed border-border overflow-hidden">
            {/* Scanner Preview Placeholder */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="relative">
                <QrCode className="h-24 w-24 text-muted-foreground/30" />
                {/* Scanning animation */}
                <div className="absolute inset-0 overflow-hidden">
                  <div className="h-1 bg-primary/50 animate-scan-line" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Kamera wird geladen...
              </p>
            </div>

            {/* Scanner Frame Corners */}
            <div className="absolute top-4 left-4 w-12 h-12 border-t-4 border-l-4 border-primary rounded-tl-lg" />
            <div className="absolute top-4 right-4 w-12 h-12 border-t-4 border-r-4 border-primary rounded-tr-lg" />
            <div className="absolute bottom-4 left-4 w-12 h-12 border-b-4 border-l-4 border-primary rounded-bl-lg" />
            <div className="absolute bottom-4 right-4 w-12 h-12 border-b-4 border-r-4 border-primary rounded-br-lg" />
          </div>

          <div className="flex items-center gap-2 mt-4">
            <Button className="flex-1">
              <Camera className="h-4 w-4" />
              Kamera starten
            </Button>
            <Button variant="outline">
              <Upload className="h-4 w-4" />
              Bild hochladen
            </Button>
          </div>

          {/* Manual Entry */}
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground mb-3">Oder Code manuell eingeben:</p>
            <div className="flex gap-2">
              <Input
                placeholder="z.B. BB-2024-0234"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="font-mono"
              />
              <Button onClick={handleManualSearch}>
                Suchen
              </Button>
            </div>
          </div>
        </div>

        {/* Result Area */}
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Ergebnis</h2>
          
          {scannedResult ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10">
                <Package className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-mono font-bold text-lg">{scannedResult.id}</p>
                  <p className="text-sm text-muted-foreground capitalize">{scannedResult.type}</p>
                </div>
              </div>

              {/* Data */}
              <div className="space-y-2">
                {Object.entries(scannedResult.data).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="text-sm text-muted-foreground capitalize">{key}</span>
                    <span className="text-sm font-medium">{value}</span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2 pt-4">
                <Button variant="outline">
                  <FileText className="h-4 w-4" />
                  Dokumente
                </Button>
                <Button variant="outline">
                  <History className="h-4 w-4" />
                  Historie
                </Button>
                <Button variant="outline">
                  <Plus className="h-4 w-4" />
                  Notiz hinzufügen
                </Button>
                <Button variant="outline">
                  <Upload className="h-4 w-4" />
                  Foto hochladen
                </Button>
              </div>

              <Button className="w-full mt-2">
                Details öffnen
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-secondary/50 mb-4">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium text-foreground">Kein Ergebnis</p>
              <p className="text-sm text-muted-foreground mt-1">
                Scannen Sie einen QR-Code oder geben Sie einen Code manuell ein
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass-card rounded-xl p-5">
        <h3 className="text-lg font-semibold text-foreground mb-4">Schnellaktionen nach Scan</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button variant="outline" className="h-auto py-4 flex-col gap-2">
            <Upload className="h-5 w-5" />
            <span className="text-sm">Dokument hochladen</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-2">
            <Camera className="h-5 w-5" />
            <span className="text-sm">Foto aufnehmen</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-2">
            <Plus className="h-5 w-5" />
            <span className="text-sm">Notiz hinzufügen</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-2">
            <History className="h-5 w-5" />
            <span className="text-sm">Timeline anzeigen</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
