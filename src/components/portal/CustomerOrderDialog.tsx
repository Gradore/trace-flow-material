import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, addDays } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CustomerOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
}

const PRODUCT_CATEGORIES = [
  { value: "UP-Harz", label: "UP-Harz Material" },
  { value: "EP-Harz", label: "EP-Harz Material" },
];

const GRAIN_SIZES = [
  { value: "0,125mm", label: "0,125mm" },
  { value: "1mm", label: "1mm" },
  { value: "3mm", label: "3mm" },
  { value: "5mm", label: "5mm" },
  { value: "Überkorn", label: "Überkorn" },
];

const SUBCATEGORIES = [
  { value: "Harz", label: "Harz" },
  { value: "Faser", label: "Faser" },
];

export function CustomerOrderDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
}: CustomerOrderDialogProps) {
  const [formData, setFormData] = useState({
    product_category: "",
    product_grain_size: "",
    product_subcategory: "",
    quantity_kg: "",
    delivery_deadline: undefined as Date | undefined,
    delivery_address: "",
    notes: "",
  });
  const queryClient = useQueryClient();

  const generateOrderId = async () => {
    const { data } = await supabase.rpc("generate_unique_id", { prefix: "AUF" });
    return data || `AUF-${Date.now()}`;
  };

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const orderId = await generateOrderId();
      const productionDeadline = data.delivery_deadline
        ? addDays(data.delivery_deadline, -3)
        : new Date();

      const { error } = await supabase.from("orders").insert({
        order_id: orderId,
        company_id: companyId,
        customer_name: companyName,
        product_category: data.product_category,
        product_grain_size: data.product_grain_size,
        product_subcategory: data.product_subcategory,
        quantity_kg: parseFloat(data.quantity_kg),
        production_deadline: productionDeadline.toISOString().split("T")[0],
        delivery_deadline: data.delivery_deadline?.toISOString().split("T")[0],
        delivery_address: data.delivery_address || null,
        notes: data.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      toast.success("Auftrag erstellt");
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Fehler: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      product_category: "",
      product_grain_size: "",
      product_subcategory: "",
      quantity_kg: "",
      delivery_deadline: undefined,
      delivery_address: "",
      notes: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !formData.product_category ||
      !formData.product_grain_size ||
      !formData.product_subcategory ||
      !formData.quantity_kg ||
      !formData.delivery_deadline
    ) {
      toast.error("Bitte füllen Sie alle Pflichtfelder aus");
      return;
    }
    mutation.mutate(formData);
  };

  const productName = formData.product_category && formData.product_grain_size && formData.product_subcategory
    ? `${formData.product_category}-${formData.product_grain_size}-${formData.product_subcategory}`
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neuer Auftrag</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label>Oberkategorie *</Label>
              <Select
                value={formData.product_category}
                onValueChange={(value) =>
                  setFormData({ ...formData, product_category: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Korngröße *</Label>
              <Select
                value={formData.product_grain_size}
                onValueChange={(value) =>
                  setFormData({ ...formData, product_grain_size: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {GRAIN_SIZES.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Unterkategorie *</Label>
              <Select
                value={formData.product_subcategory}
                onValueChange={(value) =>
                  setFormData({ ...formData, product_subcategory: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {SUBCATEGORIES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {productName && (
              <div className="p-3 rounded-md bg-muted">
                <Label className="text-sm text-muted-foreground">Produkt</Label>
                <p className="font-medium">{productName}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Menge (kg) *</Label>
              <Input
                type="number"
                value={formData.quantity_kg}
                onChange={(e) => setFormData({ ...formData, quantity_kg: e.target.value })}
                min="0"
                step="0.1"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Lieferfrist *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.delivery_deadline && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.delivery_deadline
                      ? format(formData.delivery_deadline, "dd.MM.yyyy", { locale: de })
                      : "Datum wählen..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.delivery_deadline}
                    onSelect={(date) => setFormData({ ...formData, delivery_deadline: date })}
                    disabled={(date) => date < addDays(new Date(), 3)}
                    locale={de}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Lieferadresse</Label>
              <Textarea
                value={formData.delivery_address}
                onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
                placeholder="Falls abweichend von Firmenadresse"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Bemerkungen</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Senden..." : "Auftrag erstellen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
