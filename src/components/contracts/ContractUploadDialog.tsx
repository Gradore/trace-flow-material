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
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, Sparkles, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ContractUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
}

type ExtractedData = {
  payment_terms?: string;
  delivery_terms?: string;
  freight_payer?: string;
  price_per_kg?: number;
  currency?: string;
  material_type?: string;
  valid_from?: string;
  valid_until?: string;
  contract_number?: string;
  key_terms?: string[];
};

export function ContractUploadDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
}: ContractUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [formData, setFormData] = useState({
    contract_number: "",
    payment_terms: "",
    delivery_terms: "",
    freight_payer: "",
    price_per_kg: "",
    currency: "EUR",
    material_type: "",
    valid_from: "",
    valid_until: "",
    notes: "",
  });
  const queryClient = useQueryClient();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setExtractedData(null);
    }
  };

  const extractContractData = async () => {
    if (!file) return;

    setExtracting(true);
    try {
      // Read file as text (for PDFs we'd need a PDF parser, for now we handle text)
      const text = await file.text();
      
      const { data, error } = await supabase.functions.invoke("extract-contract", {
        body: {
          pdfText: text.substring(0, 10000), // Limit text length
          contractContext: `Vertrag für ${companyName}`,
        },
      });

      if (error) throw error;

      if (data?.success && data?.data) {
        const extracted = data.data as ExtractedData;
        setExtractedData(extracted);
        
        // Pre-fill form with extracted data
        setFormData((prev) => ({
          ...prev,
          contract_number: extracted.contract_number || prev.contract_number,
          payment_terms: extracted.payment_terms || prev.payment_terms,
          delivery_terms: extracted.delivery_terms || prev.delivery_terms,
          freight_payer: extracted.freight_payer || prev.freight_payer,
          price_per_kg: extracted.price_per_kg?.toString() || prev.price_per_kg,
          currency: extracted.currency || prev.currency,
          material_type: extracted.material_type || prev.material_type,
          valid_from: extracted.valid_from || prev.valid_from,
          valid_until: extracted.valid_until || prev.valid_until,
        }));

        toast.success("Vertragsdaten erfolgreich extrahiert");
      }
    } catch (error) {
      console.error("Extraction error:", error);
      toast.error("Fehler bei der Extraktion. Bitte Daten manuell eingeben.");
    } finally {
      setExtracting(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      let pdfUrl = null;

      // Upload file if present
      if (file) {
        setUploading(true);
        const fileName = `${companyId}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(fileName, file);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("documents")
          .getPublicUrl(fileName);
        pdfUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from("company_contracts").insert({
        company_id: companyId,
        contract_number: formData.contract_number || null,
        payment_terms: formData.payment_terms || null,
        delivery_terms: formData.delivery_terms || null,
        freight_payer: formData.freight_payer || null,
        price_per_kg: formData.price_per_kg ? parseFloat(formData.price_per_kg) : null,
        currency: formData.currency,
        material_type: formData.material_type || null,
        valid_from: formData.valid_from || null,
        valid_until: formData.valid_until || null,
        notes: formData.notes || null,
        pdf_url: pdfUrl,
        extracted_data: extractedData || {},
        status: "active",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-contracts"] });
      toast.success("Vertrag gespeichert");
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Fehler: " + error.message);
    },
    onSettled: () => {
      setUploading(false);
    },
  });

  const resetForm = () => {
    setFile(null);
    setExtractedData(null);
    setFormData({
      contract_number: "",
      payment_terms: "",
      delivery_terms: "",
      freight_payer: "",
      price_per_kg: "",
      currency: "EUR",
      material_type: "",
      valid_from: "",
      valid_until: "",
      notes: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vertrag hochladen - {companyName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* File Upload Section */}
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            {file ? (
              <div className="flex items-center justify-center gap-4">
                <FileText className="h-10 w-10 text-primary" />
                <div className="text-left">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFile(null)}
                >
                  Entfernen
                </Button>
              </div>
            ) : (
              <label className="cursor-pointer">
                <Upload className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  PDF oder Textdatei hier ablegen oder klicken
                </p>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.txt,.doc,.docx"
                  onChange={handleFileChange}
                />
              </label>
            )}
          </div>

          {/* AI Extraction Button */}
          {file && !extractedData && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={extractContractData}
              disabled={extracting}
            >
              {extracting ? (
                <>
                  <Sparkles className="h-4 w-4 mr-2 animate-pulse" />
                  KI analysiert Vertrag...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Mit KI analysieren
                </>
              )}
            </Button>
          )}

          {extracting && <Progress value={66} className="h-2" />}

          {/* Extracted Data Indicator */}
          {extractedData && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg text-green-700 dark:text-green-300">
              <Check className="h-4 w-4" />
              <span className="text-sm">Daten automatisch extrahiert - bitte überprüfen</span>
            </div>
          )}

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Vertragsnummer</Label>
              <Input
                value={formData.contract_number}
                onChange={(e) => setFormData({ ...formData, contract_number: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Materialtyp</Label>
              <Input
                value={formData.material_type}
                onChange={(e) => setFormData({ ...formData, material_type: e.target.value })}
                placeholder="z.B. GFK, PP, PA"
              />
            </div>
            <div className="space-y-2">
              <Label>Zahlungsbedingungen</Label>
              <Input
                value={formData.payment_terms}
                onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                placeholder="z.B. 30 Tage netto"
              />
            </div>
            <div className="space-y-2">
              <Label>Lieferbedingungen</Label>
              <Input
                value={formData.delivery_terms}
                onChange={(e) => setFormData({ ...formData, delivery_terms: e.target.value })}
                placeholder="z.B. frei Haus, DDP"
              />
            </div>
            <div className="space-y-2">
              <Label>Fracht zahlt</Label>
              <Select
                value={formData.freight_payer}
                onValueChange={(value) => setFormData({ ...formData, freight_payer: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sender">Absender</SelectItem>
                  <SelectItem value="receiver">Empfänger</SelectItem>
                  <SelectItem value="shared">Geteilt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Preis pro kg</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={formData.price_per_kg}
                  onChange={(e) => setFormData({ ...formData, price_per_kg: e.target.value })}
                  step="0.01"
                  className="flex-1"
                />
                <Select
                  value={formData.currency}
                  onValueChange={(value) => setFormData({ ...formData, currency: value })}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="CHF">CHF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Gültig ab</Label>
              <Input
                type="date"
                value={formData.valid_from}
                onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Gültig bis</Label>
              <Input
                type="date"
                value={formData.valid_until}
                onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notizen</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          {/* Key Terms from AI */}
          {extractedData?.key_terms && extractedData.key_terms.length > 0 && (
            <div className="space-y-2">
              <Label className="text-muted-foreground">Erkannte Vertragspunkte</Label>
              <ul className="text-sm space-y-1">
                {extractedData.key_terms.map((term, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="h-4 w-4 mt-0.5 text-green-500" />
                    <span>{term}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={saveMutation.isPending || uploading}>
              {saveMutation.isPending || uploading ? "Speichern..." : "Speichern"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
