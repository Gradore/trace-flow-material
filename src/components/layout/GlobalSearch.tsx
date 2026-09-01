import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Package, Inbox, FlaskConical, FileOutput, Truck, X, Loader2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { hasAccess } from "./navigation";

type ResultType = "container" | "intake" | "sample" | "output" | "delivery";

interface SearchResult {
  id: string;
  type: ResultType;
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

const RESULT_TYPES = Object.keys(typeConfig) as ResultType[];

/**
 * PostgREST parses `or=(...)` as a comma separated list of filter items, so a
 * raw `,`, `(`, `)` or quote in the term breaks the grammar and the request
 * fails with 400. Wildcards are dropped as well so the term cannot widen its
 * own match.
 */
function sanitizeFilterTerm(term: string): string {
  return term.replace(/[,()"'\\%*]/g, " ").replace(/\s+/g, " ").trim();
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { role, isAdmin, isLoading: isRoleLoading } = useUserRole();

  // Only search the modules this role may open - the SELECT policies of the
  // underlying tables are permissive, so the scoping has to happen here.
  const allowedTypes = useMemo(
    () => RESULT_TYPES.filter((type) => hasAccess(typeConfig[type].route, role, isAdmin)),
    [role, isAdmin],
  );

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
    const term = sanitizeFilterTerm(searchQuery);

    if (!term) {
      setResults([]);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    const allResults: SearchResult[] = [];

    try {
      // Search containers
      if (allowedTypes.includes("container")) {
        const { data: containers, error } = await supabase
          .from("containers")
          .select("id, container_id, type, location")
          .or(`container_id.ilike.%${term}%,type.ilike.%${term}%,location.ilike.%${term}%`)
          .limit(5);

        if (error) throw error;

        containers?.forEach((c) => {
          allResults.push({
            id: c.id,
            type: "container",
            title: c.container_id,
            subtitle: `${c.type}${c.location ? ` • ${c.location}` : ""}`,
            icon: Package,
          });
        });
      }

      // Search material inputs
      if (allowedTypes.includes("intake")) {
        const { data: inputs, error } = await supabase
          .from("material_inputs")
          .select("id, input_id, supplier, material_type")
          .or(`input_id.ilike.%${term}%,supplier.ilike.%${term}%,material_type.ilike.%${term}%`)
          .limit(5);

        if (error) throw error;

        inputs?.forEach((i) => {
          allResults.push({
            id: i.id,
            type: "intake",
            title: i.input_id,
            subtitle: `${i.supplier} • ${i.material_type}`,
            icon: Inbox,
          });
        });
      }

      // Search samples
      if (allowedTypes.includes("sample")) {
        const { data: samples, error } = await supabase
          .from("samples")
          .select("id, sample_id, sampler_name, status")
          .or(`sample_id.ilike.%${term}%,sampler_name.ilike.%${term}%`)
          .limit(5);

        if (error) throw error;

        samples?.forEach((s) => {
          allResults.push({
            id: s.id,
            type: "sample",
            title: s.sample_id,
            subtitle: `${s.sampler_name} • ${s.status}`,
            icon: FlaskConical,
          });
        });
      }

      // Search output materials
      if (allowedTypes.includes("output")) {
        const { data: outputs, error } = await supabase
          .from("output_materials")
          .select("id, output_id, batch_id, output_type")
          .or(`output_id.ilike.%${term}%,batch_id.ilike.%${term}%,output_type.ilike.%${term}%`)
          .limit(5);

        if (error) throw error;

        outputs?.forEach((o) => {
          allResults.push({
            id: o.id,
            type: "output",
            title: o.output_id,
            subtitle: `${o.batch_id} • ${o.output_type}`,
            icon: FileOutput,
          });
        });
      }

      // Search delivery notes
      if (allowedTypes.includes("delivery")) {
        const { data: deliveries, error } = await supabase
          .from("delivery_notes")
          .select("id, note_id, partner_name, type")
          .or(`note_id.ilike.%${term}%,partner_name.ilike.%${term}%`)
          .limit(5);

        if (error) throw error;

        deliveries?.forEach((d) => {
          allResults.push({
            id: d.id,
            type: "delivery",
            title: d.note_id,
            subtitle: `${d.partner_name} • ${d.type === "incoming" ? "Eingang" : "Ausgang"}`,
            icon: Truck,
          });
        });
      }

      setResults(allResults);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
      setSearchError(error instanceof Error ? error.message : "Unbekannter Fehler");
    } finally {
      setIsSearching(false);
    }
  }, [allowedTypes]);

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

  // Nothing this role may search - do not offer a search box that can only
  // ever answer "Keine Ergebnisse".
  if (!isRoleLoading && allowedTypes.length === 0) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-2 md:px-3 py-2 rounded-lg bg-secondary/50 hover:bg-secondary text-muted-foreground text-sm transition-colors w-full"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left truncate hidden xs:inline">Suchen...</span>
        <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 max-w-lg overflow-hidden mx-2 sm:mx-auto">
          <div className="flex items-center border-b border-border px-3">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Container, Material, Probe suchen..."
              className="border-0 focus-visible:ring-0 px-3 text-base"
              autoFocus
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground p-1">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {isSearching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : searchError ? (
              <div className="py-8 px-4 text-center space-y-1">
                <AlertTriangle className="h-5 w-5 text-destructive mx-auto" />
                <p className="text-sm text-destructive">Suche fehlgeschlagen</p>
                <p className="text-xs text-muted-foreground break-words">{searchError}</p>
              </div>
            ) : results.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground px-4">
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
                      className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-secondary/50 active:bg-secondary text-left transition-colors"
                    >
                      <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{result.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">{config.label}</span>
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
