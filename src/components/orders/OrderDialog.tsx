import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import { toast } from "sonner";
import { format } from "date-fns";

type Order = {
  id: string;
  order_id: string;
  company_id?: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  product_category: string;
  product_grain_size: string;
  product_subcategory: string;
  product_name?: string | null;
  quantity_kg: number;
  production_deadline: string;
  delivery_deadline: string;
  delivery_partner: string | null;
  delivery_address: string | null;
  status: string;
  notes: string | null;
};

type CompanyOption = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

interface OrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
}

const PRODUCT_CATEGORIES = ["UP-Harz Material", "EP-Harz Material"];
const GRAIN_SIZES = ["0,125mm", "1mm", "3mm", "5mm", "Überkorn"];
const SUBCATEGORIES = ["Harz", "Faser"];

export function OrderDialog({ open, onOpenChange, order }: OrderDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    company_id: "",
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    product_category: "",
    product_grain_size: "",
    product_subcategory: "",
    quantity_kg: "",
    production_deadline: "",
    delivery_deadline: "",
    delivery_partner: "",
    delivery_address: "",
    notes: "",
  });

  useEffect(() => {
    if (order) {
      setFormData({
        company_id: order.company_id || "",
        customer_name: order.customer_name,
        customer_email: order.customer_email || "",
        customer_phone: order.customer_phone || "",
        product_category: order.product_category,
        product_grain_size: order.product_grain_size,
        product_subcategory: order.product_subcategory,
        quantity_kg: order.quantity_kg.toString(),
        production_deadline: order.production_deadline,
        delivery_deadline: order.delivery_deadline,
        delivery_partner: order.delivery_partner || "",
        delivery_address: order.delivery_address || "",
        notes: order.notes || "",
      });
    } else {
      setFormData({
        company_id: "",
        customer_name: "",
        customer_email: "",
        customer_phone: "",
        product_category: "",
        product_grain_size: "",
        product_subcategory: "",
        quantity_kg: "",
        production_deadline: "",
        delivery_deadline: "",
        delivery_partner: "",
        delivery_address: "",
        notes: "",
      });
    }
  }, [order, open]);

  const {
    data: companies,
    isError: companiesError,
  } = useQuery({
    queryKey: ["companies", "order-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, email, phone")
        .in("type", ["customer", "both"])
        .eq("status", "active")
        .order("name", { ascending: true });

      if (error) throw error;
      return data as CompanyOption[];
    },
    enabled: open,
  });

  const handleCompanyChange = (companyId: string) => {
    const company = companies?.find((c) => c.id === companyId);
    setFormData((prev) => {
      if (prev.company_id === companyId) return prev;
      // Contact data always follows the selected company. Only a manual entry
      // made before any company was picked survives - switching from Firma A to
      // Firma B must never keep Firma A's e-mail/phone on the order.
      const isFirstSelection = !prev.company_id;
      return {
        ...prev,
        company_id: companyId,
        customer_name: company?.name || prev.customer_name,
        customer_email: company?.email || (isFirstSelection ? prev.customer_email : ""),
        customer_phone: company?.phone || (isFirstSelection ? prev.customer_phone : ""),
      };
    });
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Generate order ID using database function with retry logic
      let orderId: string | null = null;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (!orderId && attempts < maxAttempts) {
        attempts++;
        const { data: idData, error: idError } = await supabase.rpc("generate_unique_id", { prefix: "AUF" });
        
        if (idError) {
          console.error(`ID generation attempt ${attempts} failed:`, idError);
          if (attempts >= maxAttempts) {
            // Fallback: generate a unique ID client-side
            orderId = `AUF-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
          }
        } else {
          orderId = idData as string;
        }
      }
      
      if (!orderId) {
        throw new Error("Auftrags-ID konnte nicht generiert werden. Bitte versuchen Sie es erneut.");
      }

      // product_name is a generated column in the DB and must not be written
      const { error } = await supabase.from("orders").insert({
        order_id: orderId,
        company_id: data.company_id || null,
        customer_name: data.customer_name.trim(),
        customer_email: data.customer_email || null,
        customer_phone: data.customer_phone || null,
        product_category: data.product_category,
        product_grain_size: data.product_grain_size,
        product_subcategory: data.product_subcategory,
        quantity_kg: parseFloat(data.quantity_kg),
        production_deadline: data.production_deadline,
        delivery_deadline: data.delivery_deadline,
        delivery_partner: data.delivery_partner || null,
        delivery_address: data.delivery_address || null,
        notes: data.notes || null,
        created_by: user?.id,
      });

      if (error) {
        console.error("Order insert error:", error);
        if (error.code === '23505') {
          // Duplicate key - retry with new ID
          throw new Error("Auftrags-ID Konflikt. Bitte versuchen Sie es erneut.");
        }
        if (error.code === '42501') {
          throw new Error("Keine Berechtigung zum Erstellen von Aufträgen.");
        }
        throw new Error(`Auftrag konnte nicht erstellt werden: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Auftrag erfolgreich erstellt");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      console.error("Order creation error:", error);
      toast.error(error.message || "Fehler beim Erstellen. Bitte überprüfen Sie Ihre Eingaben und Berechtigungen.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!order) return;

      // product_name is a generated column in the DB and must not be written
      const { data: updated, error } = await supabase
        .from("orders")
        .update({
          company_id: data.company_id || null,
          customer_name: data.customer_name,
          customer_email: data.customer_email || null,
          customer_phone: data.customer_phone || null,
          product_category: data.product_category,
          product_grain_size: data.product_grain_size,
          product_subcategory: data.product_subcategory,
          quantity_kg: parseFloat(data.quantity_kg),
          production_deadline: data.production_deadline,
          delivery_deadline: data.delivery_deadline,
          delivery_partner: data.delivery_partner || null,
          delivery_address: data.delivery_address || null,
          notes: data.notes || null,
        })
        .eq("id", order.id)
        .select("id");

      if (error) throw error;
      if (!updated || updated.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Auftrag erfolgreich aktualisiert");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      console.error("Order update error:", error);
      toast.error("Fehler beim Aktualisieren: " + (error.message || "Bitte überprüfen Sie Ihre Berechtigungen."));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.company_id && !formData.customer_name) {
      toast.error("Bitte einen Kunden auswählen");
      return;
    }

    if (!formData.customer_name || !formData.product_category || !formData.product_grain_size || !formData.product_subcategory || !formData.quantity_kg || !formData.production_deadline || !formData.delivery_deadline) {
      toast.error("Bitte alle Pflichtfelder ausfüllen");
      return;
    }

    if (order) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const productPreview = formData.product_category && formData.product_grain_size && formData.product_subcategory
    ? `${formData.product_category}-${formData.product_grain_size}-${formData.product_subcategory}`
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {order ? "Auftrag bearbeiten" : "Neuer Auftrag"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Kundeninformationen
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_id">Kunde *</Label>
                <Select
                  value={formData.company_id}
                  onValueChange={handleCompanyChange}
                >
                  <SelectTrigger id="company_id">
                    <SelectValue placeholder="Firma wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {companies?.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {companiesError && (
                  <p className="text-xs text-destructive">
                    Firmen konnten nicht geladen werden.
                  </p>
                )}
                {!formData.company_id && formData.customer_name && (
                  <p className="text-xs text-muted-foreground">
                    Erfasster Kunde: {formData.customer_name} (keiner Firma zugeordnet)
                  </p>
                )}
                {/* The list only holds active customers - an order pointing at an
                    inactive company would otherwise show an empty required field. */}
                {formData.company_id &&
                  companies &&
                  !companies.some((c) => c.id === formData.company_id) && (
                    <p className="text-xs text-muted-foreground">
                      Zugeordnete Firma: {formData.customer_name || "unbekannt"} (nicht in der
                      Auswahl - inaktiv oder kein Kunde)
                    </p>
                  )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer_email">E-Mail</Label>
                <Input
                  id="customer_email"
                  type="email"
                  value={formData.customer_email}
                  onChange={(e) =>
                    setFormData({ ...formData, customer_email: e.target.value })
                  }
                  placeholder="kunde@beispiel.de"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="customer_phone">Telefon</Label>
                <Input
                  id="customer_phone"
                  value={formData.customer_phone}
                  onChange={(e) =>
                    setFormData({ ...formData, customer_phone: e.target.value })
                  }
                  placeholder="+49 123 456789"
                />
              </div>
            </div>
          </div>

          {/* Product Configuration */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Produktkonfiguration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Oberkategorie *</Label>
                <Select
                  value={formData.product_category}
                  onValueChange={(value) =>
                    setFormData({ ...formData, product_category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
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
                    <SelectValue placeholder="Wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {GRAIN_SIZES.map((size) => (
                      <SelectItem key={size} value={size}>
                        {size}
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
                    <SelectValue placeholder="Wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBCATEGORIES.map((sub) => (
                      <SelectItem key={sub} value={sub}>
                        {sub}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {productPreview && (
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm text-muted-foreground">Produktname:</p>
                <p className="font-semibold">{productPreview}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="quantity_kg">Menge (kg) *</Label>
              <Input
                id="quantity_kg"
                type="number"
                step="0.01"
                min="0"
                value={formData.quantity_kg}
                onChange={(e) =>
                  setFormData({ ...formData, quantity_kg: e.target.value })
                }
                placeholder="1000"
                required
              />
            </div>
          </div>

          {/* Deadlines */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Termine
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="production_deadline">Produktion bis *</Label>
                <Input
                  id="production_deadline"
                  type="date"
                  value={formData.production_deadline}
                  onChange={(e) =>
                    setFormData({ ...formData, production_deadline: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delivery_deadline">Lieferung bis *</Label>
                <Input
                  id="delivery_deadline"
                  type="date"
                  value={formData.delivery_deadline}
                  onChange={(e) =>
                    setFormData({ ...formData, delivery_deadline: e.target.value })
                  }
                  required
                />
              </div>
            </div>
          </div>

          {/* Delivery Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Lieferinformationen
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="delivery_partner">Lieferpartner / Spedition</Label>
                <Input
                  id="delivery_partner"
                  value={formData.delivery_partner}
                  onChange={(e) =>
                    setFormData({ ...formData, delivery_partner: e.target.value })
                  }
                  placeholder="z.B. DHL, Schenker, Selbstabholung"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delivery_address">Lieferadresse</Label>
                <Input
                  id="delivery_address"
                  value={formData.delivery_address}
                  onChange={(e) =>
                    setFormData({ ...formData, delivery_address: e.target.value })
                  }
                  placeholder="Straße, PLZ Ort"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Bemerkungen</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Zusätzliche Informationen..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {order ? "Speichern" : "Erstellen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
