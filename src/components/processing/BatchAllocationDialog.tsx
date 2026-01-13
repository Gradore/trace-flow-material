import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Users, Loader2, Package, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface BatchAllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outputMaterial: {
    id: string;
    output_id: string;
    batch_id: string;
    output_type: string;
    weight_kg: number;
    quality_grade?: string;
  } | null;
}

interface ExistingAllocation {
  id: string;
  order_id: string;
  allocated_weight_kg: number;
  orders?: {
    order_id: string;
    customer_name: string;
  };
}

export function BatchAllocationDialog({
  open,
  onOpenChange,
  outputMaterial,
}: BatchAllocationDialogProps) {
  const [selectedOrder, setSelectedOrder] = useState("");
  const [allocatedWeight, setAllocatedWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch pending orders
  const { data: pendingOrders = [] } = useQuery({
    queryKey: ["orders-for-allocation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_id, customer_name, product_name, quantity_kg, status")
        .in("status", ["pending", "in_production", "confirmed"])
        .order("production_deadline", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch existing allocations for this output material
  const { data: existingAllocations = [] } = useQuery({
    queryKey: ["batch-allocations", outputMaterial?.id],
    queryFn: async () => {
      if (!outputMaterial?.id) return [];
      const { data, error } = await supabase
        .from("batch_allocations")
        .select(`
          id,
          order_id,
          allocated_weight_kg,
          orders (
            order_id,
            customer_name
          )
        `)
        .eq("output_material_id", outputMaterial.id);
      if (error) throw error;
      return data as ExistingAllocation[];
    },
    enabled: open && !!outputMaterial?.id,
  });

  // Calculate remaining weight
  const totalAllocated = existingAllocations.reduce(
    (sum, a) => sum + Number(a.allocated_weight_kg),
    0
  );
  const remainingWeight = outputMaterial ? outputMaterial.weight_kg - totalAllocated : 0;

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedOrder("");
      setAllocatedWeight("");
      setNotes("");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outputMaterial || !selectedOrder) return;

    const weight = parseFloat(allocatedWeight);
    if (isNaN(weight) || weight <= 0) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie ein gültiges Gewicht ein.",
        variant: "destructive",
      });
      return;
    }

    if (weight > remainingWeight) {
      toast({
        title: "Fehler",
        description: `Maximales verfügbares Gewicht: ${remainingWeight.toFixed(2)} kg`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("batch_allocations").insert({
        output_material_id: outputMaterial.id,
        order_id: selectedOrder,
        allocated_weight_kg: weight,
        allocated_by: user?.id || null,
        notes: notes.trim() || null,
      });

      if (error) {
        console.error("Error creating allocation:", error);
        if ((error as any).code === "23505") {
          throw new Error("Diese Charge ist bereits diesem Auftrag zugeordnet.");
        }
        throw new Error("Zuordnung konnte nicht erstellt werden.");
      }

      // Update order status to in_production if pending
      const targetOrder = pendingOrders.find((o) => o.id === selectedOrder);
      if (targetOrder && targetOrder.status === "pending") {
        await supabase
          .from("orders")
          .update({ status: "in_production" })
          .eq("id", selectedOrder);
      }

      toast({
        title: "Zuordnung erstellt",
        description: `${weight} kg wurden dem Auftrag zugeordnet.`,
      });

      queryClient.invalidateQueries({ queryKey: ["batch-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["output-materials"] });
      
      setSelectedOrder("");
      setAllocatedWeight("");
      setNotes("");
      onOpenChange(false);
    } catch (error: any) {
      console.error("BatchAllocationDialog error:", error);
      toast({
        title: "Fehler",
        description: error.message || "Ein Fehler ist aufgetreten.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!outputMaterial) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Charge zuordnen
          </DialogTitle>
          <DialogDescription>
            Ordnen Sie diese Charge einem Kundenauftrag zu und legen Sie die Menge fest.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Output Material Info */}
          <div className="p-4 rounded-lg bg-secondary/30 border border-border space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-primary" />
              <span className="font-medium">Chargendetails</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Charge:</span>
                <span className="ml-2 font-mono">{outputMaterial.batch_id}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Typ:</span>
                <span className="ml-2">{outputMaterial.output_type}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Gesamtgewicht:</span>
                <span className="ml-2 font-medium">{outputMaterial.weight_kg} kg</span>
              </div>
              <div>
                <span className="text-muted-foreground">Verfügbar:</span>
                <span className={`ml-2 font-medium ${remainingWeight <= 0 ? 'text-destructive' : 'text-success'}`}>
                  {remainingWeight.toFixed(2)} kg
                </span>
              </div>
            </div>
          </div>

          {/* Existing Allocations */}
          {existingAllocations.length > 0 && (
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-sm font-medium mb-2">Bestehende Zuordnungen:</p>
              <div className="space-y-1">
                {existingAllocations.map((a) => (
                  <div key={a.id} className="flex justify-between text-sm">
                    <span>{a.orders?.customer_name || a.orders?.order_id}</span>
                    <span className="font-mono">{a.allocated_weight_kg} kg</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {remainingWeight <= 0 ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Diese Charge ist vollständig zugeordnet.</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Auftrag auswählen *</Label>
                <Select value={selectedOrder} onValueChange={setSelectedOrder}>
                  <SelectTrigger>
                    <SelectValue placeholder="Auftrag wählen" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    {pendingOrders.map((order) => (
                      <SelectItem key={order.id} value={order.id}>
                        <div className="flex flex-col">
                          <span>{order.order_id} - {order.customer_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {order.product_name || "Ohne Produkt"} • {order.quantity_kg} kg
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                    {pendingOrders.length === 0 && (
                      <SelectItem value="none" disabled>
                        Keine offenen Aufträge
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight">Zuzuordnende Menge (kg) *</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={remainingWeight}
                  placeholder={`Max. ${remainingWeight.toFixed(2)} kg`}
                  value={allocatedWeight}
                  onChange={(e) => setAllocatedWeight(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Anmerkungen (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Zusätzliche Anmerkungen zur Zuordnung"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Abbrechen
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !selectedOrder || !allocatedWeight}
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Zuordnung erstellen
                </Button>
              </DialogFooter>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
