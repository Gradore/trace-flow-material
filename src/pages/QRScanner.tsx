import { useState, useEffect } from "react";
import { QrCode, Camera, Upload, Package, FileText, History, Plus, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQRScanner, parseRecyTrackQRCode } from "@/hooks/useQRScanner";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

export default function QRScanner() {
  const [manualCode, setManualCode] = useState("");
  const [scannedResult, setScannedResult] = useState<{
    type: string;
    id: string;
    data: Record<string, string>;
  } | null>(null);
  const navigate = useNavigate();

  const { isScanning, error, startScanning, stopScanning } = useQRScanner({
    onScanSuccess: (result) => {
      handleScanResult(result);
    },
  });

  const handleScanResult = (result: string) => {
    const parsed = parseRecyTrackQRCode(result);
    
    if (parsed) {
      const mockData: Record<string, Record<string, string>> = {
        containers: {
          typ: "BigBag",
          material: "GFK-UP",
          gewicht: "450 kg",
          standort: "Halle A, Regal 12",
          status: "Voll",
        },
        intake: {
          lieferant: "Recycling GmbH",
          material: "GFK-UP",
          gewicht: "2500 kg",
          datum: new Date().toLocaleDateString("de-DE"),
          status: "Eingegangen",
        },
        output: {
          typ: "Recycelte Glasfasern",
          gewicht: "1850 kg",
          qualität: "A",
          status: "Auf Lager",
        },
      };

      setScannedResult({
        type: parsed.type,
        id: parsed.id,
        data: mockData[parsed.type] || { info: "Keine Details verfügbar" },
      });

      toast({
        title: "QR-Code erkannt",
        description: `${parsed.id} gefunden`,
      });
    } else {
      toast({
        title: "Ungültiger QR-Code",
        description: "Der gescannte Code ist kein gültiger RecyTrack-Code.",
        variant: "destructive",
      });
    }
  };

  const handleManualSearch = () => {
    if (!manualCode.trim()) return;
    handleScanResult(manualCode);
  };

  const handleStartCamera = async () => {
    if (isScanning) {
      await stopScanning();
    } else {
      await startScanning("qr-reader");
    }
  };

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">QR-Scanner</h1>
          <p className="text-muted-foreground mt-1">Container oder Material per QR-Code aufrufen</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">QR-Code scannen</h2>
          
          <div className="relative aspect-square max-w-md mx-auto rounded-xl bg-secondary/30 border-2 border-dashed border-border overflow-hidden">
            <div id="qr-reader" className="w-full h-full">
              {!isScanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <QrCode className="h-24 w-24 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground mt-4">
                    Kamera starten um QR-Code zu scannen
                  </p>
                </div>
              )}
            </div>

            {isScanning && (
              <>
                <div className="absolute top-4 left-4 w-12 h-12 border-t-4 border-l-4 border-primary rounded-tl-lg z-10" />
                <div className="absolute top-4 right-4 w-12 h-12 border-t-4 border-r-4 border-primary rounded-tr-lg z-10" />
                <div className="absolute bottom-4 left-4 w-12 h-12 border-b-4 border-l-4 border-primary rounded-bl-lg z-10" />
                <div className="absolute bottom-4 right-4 w-12 h-12 border-b-4 border-r-4 border-primary rounded-br-lg z-10" />
              </>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center gap-2 mt-4">
            <Button 
              className="flex-1" 
              onClick={handleStartCamera}
              variant={isScanning ? "destructive" : "default"}
            >
              {isScanning ? (
                <>
                  <X className="h-4 w-4" />
                  Stoppen
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4" />
                  Kamera starten
                </>
              )}
            </Button>
          </div>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground mb-3">Oder Code manuell eingeben:</p>
            <div className="flex gap-2">
              <Input
                placeholder="z.B. BB-2024-0234"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="font-mono"
                onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
              />
              <Button onClick={handleManualSearch}>
                Suchen
              </Button>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Ergebnis</h2>
          
          {scannedResult ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10">
                <Package className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-mono font-bold text-lg">{scannedResult.id}</p>
                  <p className="text-sm text-muted-foreground capitalize">{scannedResult.type}</p>
                </div>
              </div>

              <div className="space-y-2">
                {Object.entries(scannedResult.data).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="text-sm text-muted-foreground capitalize">{key}</span>
                    <span className="text-sm font-medium">{value}</span>
                  </div>
                ))}
              </div>

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

              <Button className="w-full mt-2" onClick={() => navigate(`/${scannedResult.type}`)}>
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
