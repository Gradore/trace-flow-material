import { useState, useEffect, useCallback } from "react";
import { Search, Package, Inbox, FlaskConical, FileOutput, Truck, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface SearchResult {
  id: string;
  type: "container" | "intake" | "sample" | "output" | "delivery";
  title: string;
  subtitle: string;
  icon: typeof Package;
}

const typeConfig = {
  container: { icon: Package, label: "Container", route: "/containers" },
  intake: { icon: Inbox, label: "Materialeingang", route: "/intake" },
  sample: { icon: FlaskConical, label: "Probe", route: "/sampling" },
  output: { icon: FileOutput, label: "Ausgangsmaterial", route: "/output" },
  delivery: { icon: Truck, label: "Lieferschein", route: "/delivery-notes" },
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    const allResults: SearchResult[] = [];

    try {
      // Search containers
      const { data: containers } = await supabase
        .from("containers")
        .select("id, container_id, type, location")
        .or(`container_id.ilike.%${searchQuery}%,type.ilike.%${searchQuery}%,location.ilike.%${searchQuery}%`)
        .limit(5);

      containers?.forEach((c) => {
        allResults.push({
          id: c.id,
          type: "container",
          title: c.container_id,
          subtitle: `${c.type}${c.location ? ` • ${c.location}` : ""}`,
          icon: Package,
        });
      });

      // Search material inputs
      const { data: inputs } = await supabase
        .from("material_inputs")
        .select("id, input_id, supplier, material_type")
        .or(`input_id.ilike.%${searchQuery}%,supplier.ilike.%${searchQuery}%,material_type.ilike.%${searchQuery}%`)
        .limit(5);

      inputs?.forEach((i) => {
        allResults.push({
          id: i.id,
          type: "intake",
          title: i.input_id,
          subtitle: `${i.supplier} • ${i.material_type}`,
          icon: Inbox,
        });
      });

      // Search samples
      const { data: samples } = await supabase
        .from("samples")
        .select("id, sample_id, sampler_name, status")
        .or(`sample_id.ilike.%${searchQuery}%,sampler_name.ilike.%${searchQuery}%`)
        .limit(5);

      samples?.forEach((s) => {
        allResults.push({
          id: s.id,
          type: "sample",
          title: s.sample_id,
          subtitle: `${s.sampler_name} • ${s.status}`,
          icon: FlaskConical,
        });
      });

      // Search output materials
      const { data: outputs } = await supabase
        .from("output_materials")
        .select("id, output_id, batch_id, output_type")
        .or(`output_id.ilike.%${searchQuery}%,batch_id.ilike.%${searchQuery}%,output_type.ilike.%${searchQuery}%`)
        .limit(5);

      outputs?.forEach((o) => {
        allResults.push({
          id: o.id,
          type: "output",
          title: o.output_id,
          subtitle: `${o.batch_id} • ${o.output_type}`,
          icon: FileOutput,
        });
      });

      // Search delivery notes
      const { data: deliveries } = await supabase
        .from("delivery_notes")
        .select("id, note_id, partner_name, type")
        .or(`note_id.ilike.%${searchQuery}%,partner_name.ilike.%${searchQuery}%`)
        .limit(5);

      deliveries?.forEach((d) => {
        allResults.push({
          id: d.id,
          type: "delivery",
          title: d.note_id,
          subtitle: `${d.partner_name} • ${d.type === "incoming" ? "Eingang" : "Ausgang"}`,
          icon: Truck,
        });
      });

      setResults(allResults);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      search(query);
    }, 300);

    return () => clearTimeout(debounce);
  }, [query, search]);

  const handleSelect = (result: SearchResult) => {
    const config = typeConfig[result.type];
    navigate(config.route);
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 hover:bg-secondary text-muted-foreground text-sm transition-colors w-full max-w-xs"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Suchen...</span>
        <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 max-w-lg overflow-hidden">
          <div className="flex items-center border-b border-border px-3">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Container, Material, Probe suchen..."
              className="border-0 focus-visible:ring-0 px-3"
              autoFocus
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {isSearching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : results.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {query ? "Keine Ergebnisse gefunden" : "Beginne zu tippen..."}
              </div>
            ) : (
              <div className="p-2">
                {results.map((result) => {
                  const Icon = result.icon;
                  const config = typeConfig[result.type];
                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleSelect(result)}
                      className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-secondary/50 text-left transition-colors"
                    >
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{result.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{config.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
