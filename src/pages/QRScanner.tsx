import { useState, useEffect } from "react";
import { QrCode, Camera, Package, FileText, History, Plus, AlertCircle, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQRScanner, parseRecyTrackQRCode } from "@/hooks/useQRScanner";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ScannedData {
  type: string;
  id: string;
  dbId?: string;
  data: Record<string, string>;
}

export default function QRScanner() {
  const [manualCode, setManualCode] = useState("");
  const [scannedResult, setScannedResult] = useState<ScannedData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const { isScanning, error, startScanning, stopScanning } = useQRScanner({
    onScanSuccess: (result) => {
      handleScanResult(result);
    },
  });

  const handleScanResult = async (result: string) => {
    const parsed = parseRecyTrackQRCode(result);
    
    if (!parsed) {
      toast({
        title: "Ungültiger QR-Code",
        description: "Der gescannte Code ist kein gültiger RecyTrack-Code.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      let data: Record<string, string> = {};
      let dbId: string | undefined;

      switch (parsed.type) {
        case 'containers': {
          const { data: container } = await supabase
            .from('containers')
            .select('*')
            .eq('container_id', parsed.id)
            .maybeSingle();

          if (container) {
            dbId = container.id;
            data = {
              Typ: container.type,
              Status: container.status === 'empty' ? 'Leer' : container.status === 'in_use' ? 'In Verwendung' : 'Voll',
              Standort: container.location || '-',
              Gewicht: container.weight_kg ? `${container.weight_kg} kg` : '-',
              Volumen: container.volume_liters ? `${container.volume_liters} L` : '-',
            };
          }
          break;
        }
        case 'intake': {
          const { data: intake } = await supabase
            .from('material_inputs')
            .select('*')
            .eq('input_id', parsed.id)
            .maybeSingle();

          if (intake) {
            dbId = intake.id;
            data = {
              Lieferant: intake.supplier,
              Material: `${intake.material_type}${intake.material_subtype ? `-${intake.material_subtype}` : ''}`,
              Gewicht: `${intake.weight_kg} kg`,
              Status: intake.status === 'received' ? 'Eingegangen' : intake.status === 'in_processing' ? 'In Verarbeitung' : 'Verarbeitet',
              Abfallschlüssel: intake.waste_code || '-',
            };
          }
          break;
        }
        case 'output': {
          const { data: output } = await supabase
            .from('output_materials')
            .select('*')
            .eq('output_id', parsed.id)
            .maybeSingle();

          if (output) {
            dbId = output.id;
            data = {
              Typ: output.output_type,
              Charge: output.batch_id,
              Gewicht: `${output.weight_kg} kg`,
              Qualität: output.quality_grade || '-',
              Status: output.status === 'in_stock' ? 'Auf Lager' : output.status === 'shipped' ? 'Versandt' : output.status,
            };
          }
          break;
        }
        case 'delivery': {
          const { data: note } = await supabase
            .from('delivery_notes')
            .select('*')
            .eq('note_id', parsed.id)
            .maybeSingle();

          if (note) {
            dbId = note.id;
            data = {
              Typ: note.type === 'incoming' ? 'Eingang' : 'Ausgang',
              Partner: note.partner_name,
              Material: note.material_description,
              Gewicht: `${note.weight_kg} kg`,
              Abfallschlüssel: note.waste_code || '-',
            };
          }
          break;
        }
      }

      if (Object.keys(data).length === 0) {
        data = { Info: "Keine Daten gefunden" };
      }

      setScannedResult({
        type: parsed.type,
        id: parsed.id,
        dbId,
        data,
      });

      toast({
        title: "QR-Code erkannt",
        description: `${parsed.id} gefunden`,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Fehler",
        description: "Daten konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSearch = () => {
    if (!manualCode.trim()) return;
    
    // Try to determine type from ID prefix
    let fullUrl = manualCode;
    if (manualCode.startsWith('BB-') || manualCode.startsWith('IBC-') || manualCode.startsWith('SB-')) {
      fullUrl = `containers/${manualCode}`;
    } else if (manualCode.startsWith('ME-')) {
      fullUrl = `intake/${manualCode}`;
    } else if (manualCode.startsWith('OUT-')) {
      fullUrl = `output/${manualCode}`;
    } else if (manualCode.startsWith('LS-')) {
      fullUrl = `delivery/${manualCode}`;
    }
    
    handleScanResult(fullUrl);
  };

  const handleStartCamera = async () => {
    if (isScanning) {
      await stopScanning();
    } else {
      await startScanning("qr-reader");
    }
  };

  const handleNavigateToDetails = () => {
    if (!scannedResult) return;
    
    const routeMap: Record<string, string> = {
      containers: '/containers',
      intake: '/material-intake',
      output: '/output-materials',
      delivery: '/delivery-notes',
    };

    navigate(routeMap[scannedResult.type] || '/');
  };

  const handleNavigateToTraceability = () => {
    if (!scannedResult) return;
    navigate(`/traceability?search=${scannedResult.id}`);
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
                placeholder="z.B. BB-2024-0234 oder ME-2024-0001"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="font-mono"
                onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
              />
              <Button onClick={handleManualSearch} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Suchen'}
              </Button>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Ergebnis</h2>
          
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground mt-4">Lade Daten...</p>
            </div>
          ) : scannedResult ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10">
                <Package className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-mono font-bold text-lg">{scannedResult.id}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {scannedResult.type === 'containers' ? 'Container' : 
                     scannedResult.type === 'intake' ? 'Materialeingang' :
                     scannedResult.type === 'output' ? 'Ausgangsmaterial' :
                     scannedResult.type === 'delivery' ? 'Lieferschein' : scannedResult.type}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {Object.entries(scannedResult.data).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="text-sm text-muted-foreground">{key}</span>
                    <span className="text-sm font-medium">{value}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-4">
                <Button variant="outline" onClick={handleNavigateToDetails}>
                  <FileText className="h-4 w-4" />
                  Details
                </Button>
                <Button variant="outline" onClick={handleNavigateToTraceability}>
                  <History className="h-4 w-4" />
                  Historie
                </Button>
              </div>

              <Button className="w-full mt-2" onClick={handleNavigateToDetails}>
                Zur Übersicht
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
        <h3 className="text-lg font-semibold text-foreground mb-4">Unterstützte Codes</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-secondary/30">
            <p className="font-mono text-sm font-medium">BB-XXXX-XXXX</p>
            <p className="text-xs text-muted-foreground mt-1">BigBag Container</p>
          </div>
          <div className="p-3 rounded-lg bg-secondary/30">
            <p className="font-mono text-sm font-medium">ME-XXXX-XXXX</p>
            <p className="text-xs text-muted-foreground mt-1">Materialeingang</p>
          </div>
          <div className="p-3 rounded-lg bg-secondary/30">
            <p className="font-mono text-sm font-medium">OUT-XXXX-XXXX</p>
            <p className="text-xs text-muted-foreground mt-1">Ausgangsmaterial</p>
          </div>
          <div className="p-3 rounded-lg bg-secondary/30">
            <p className="font-mono text-sm font-medium">LS-XXXX-XXXX</p>
            <p className="text-xs text-muted-foreground mt-1">Lieferschein</p>
          </div>
        </div>
      </div>
    </div>
  );
}
