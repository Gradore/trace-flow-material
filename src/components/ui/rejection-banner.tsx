import { AlertTriangle, XCircle, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface RejectionBannerProps {
  type: "sample" | "material" | "batch";
  id: string;
  reason?: string;
  onRevertRejection?: () => Promise<void>;
  canRevert?: boolean;
  className?: string;
}

/**
 * A prominent banner showing rejection status with option to revert.
 */
export function RejectionBanner({ 
  type, 
  id, 
  reason, 
  onRevertRejection, 
  canRevert = true,
  className 
}: RejectionBannerProps) {
  const [isReverting, setIsReverting] = useState(false);
  
  const typeLabels = {
    sample: "Probe",
    material: "Materialeingang",
    batch: "Charge",
  };

  const handleRevert = async () => {
    if (!onRevertRejection) return;
    setIsReverting(true);
    try {
      await onRevertRejection();
    } finally {
      setIsReverting(false);
    }
  };

  return (
    <div className={cn(
      "bg-destructive/10 border border-destructive/30 rounded-lg p-4",
      className
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-destructive/20 shrink-0">
            <XCircle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h4 className="font-semibold text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {typeLabels[type]} abgelehnt
            </h4>
            <p className="text-sm text-destructive/90 mt-1">
              {id} wurde abgelehnt. 
              {type === "material" && " Keine weiteren Verarbeitungsschritte möglich."}
            </p>
            {reason && (
              <p className="text-sm text-muted-foreground mt-2">
                Grund: {reason}
              </p>
            )}
          </div>
        </div>
        
        {canRevert && onRevertRejection && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10"
                disabled={isReverting}
              >
                {isReverting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-2" />
                )}
                Ablehnung zurücknehmen
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Ablehnung zurücknehmen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Möchten Sie die Ablehnung für {typeLabels[type]} {id} wirklich zurücknehmen? 
                  Der Status wird auf 'In Analyse' zurückgesetzt.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={handleRevert}>
                  Ablehnung zurücknehmen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
