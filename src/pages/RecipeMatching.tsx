import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { 
  FlaskConical, 
  Upload, 
  Sparkles, 
  FileText, 
  CheckCircle,
  Loader2,
  Beaker,
  Target,
  ChevronRight,
  Settings,
  Plus,
  Trash2,
  Zap,
  ArrowLeft,
  BarChart3,
  Lightbulb,
} from "lucide-react";

// ── Types ──
interface RecipeComponent {
  id: string;
  name: string;
  type: "polymer" | "additive" | "filler" | "fiber";
  concentration: number;
}

type WizardStep = "recipe" | "process" | "analysis";

const STEPS: { id: WizardStep; label: string; icon: any }[] = [
  { id: "recipe", label: "Rezeptur", icon: FlaskConical },
  { id: "process", label: "Prozess", icon: Settings },
  { id: "analysis", label: "KI-Analyse", icon: Sparkles },
];

const MATERIAL_TYPES = [
  "PP", "PE-HD", "PE-LD", "PA6", "PA66", "PET", "ABS", "PS", "PC", "POM", "PBT", "TPE", "GFK",
];

const ADDITIVE_TYPES = [
  "Glasfaser", "Talkum", "Kreide (CaCO3)", "Ruß", "Stabilisator UV", "Stabilisator Thermo",
  "Flammschutz", "Haftvermittler", "Gleitmittel", "Farbmasterbatch", "Schlagzähmodifizierer",
];

export default function RecipeMatching() {
  const queryClient = useQueryClient();

  // Wizard state
  const [activeView, setActiveView] = useState<"wizard" | "list" | "detail">("list");
  const [wizardStep, setWizardStep] = useState<WizardStep>("recipe");

  // Recipe form
  const [recipeName, setRecipeName] = useState("");
  const [recipeDescription, setRecipeDescription] = useState("");
  const [components, setComponents] = useState<RecipeComponent[]>([]);
  const [newComponentName, setNewComponentName] = useState("");

  // Process params
  const [processTemp, setProcessTemp] = useState("");
  const [processPressure, setProcessPressure] = useState("");
  const [processThroughput, setProcessThroughput] = useState("");
  const [processNotes, setProcessNotes] = useState("");

  // Analysis
  const [datasheetText, setDatasheetText] = useState("");
  const [materialContext, setMaterialContext] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  // Detail view
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);

  // Fetch orders
  const { data: orders } = useQuery({
    queryKey: ['orders-for-matching'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['pending', 'in_production'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Fetch existing recipes
  const { data: recipes } = useQuery({
    queryKey: ['recipes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Fetch samples
  const { data: samplesWithResults } = useQuery({
    queryKey: ['samples-with-results'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('samples')
        .select(`
          *,
          sample_results (*),
          material_input:material_inputs (
            input_id,
            material_type,
            supplier
          )
        `)
        .eq('status', 'completed')
        .order('analyzed_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    }
  });

  // Analyze mutation
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      setIsAnalyzing(true);
      const compositionText = components.length > 0
        ? components.map(c => `${c.name}: ${c.concentration}%`).join(', ')
        : '';

      const fullContext = [
        materialContext,
        compositionText && `Rezeptur: ${compositionText}`,
        processTemp && `Verarbeitungstemperatur: ${processTemp}°C`,
        processThroughput && `Durchsatz: ${processThroughput} kg/h`,
      ].filter(Boolean).join('\n');

      const { data, error } = await supabase.functions.invoke('analyze-datasheet', {
        body: {
          datasheetText: datasheetText || compositionText,
          materialContext: fullContext,
          analysisType: 'recipe_matching'
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setAnalysisResult(data.result);
      toast.success('KI-Analyse abgeschlossen');
    },
    onError: (error) => {
      toast.error(`Analyse fehlgeschlagen: ${error.message}`);
    },
    onSettled: () => {
      setIsAnalyzing(false);
    }
  });

  // Save recipe
  const saveRecipeMutation = useMutation({
    mutationFn: async (recipe: any) => {
      const { data: recipeId } = await supabase.rpc('generate_unique_id', { prefix: 'REZ' });
      const { error } = await supabase
        .from('recipes')
        .insert({
          recipe_id: recipeId,
          name: recipe.name || recipeName || 'Neue Rezeptur',
          description: recipe.description || recipeDescription,
          material_composition: recipe.composition || components.reduce((acc: any, c) => {
            acc[c.name] = `${c.concentration}%`;
            return acc;
          }, {}),
          target_properties: analysisResult?.properties,
          applications: recipe.applications || [],
          recommended_for: recipe.recommended_for || [],
          confidence_score: recipe.match_score,
          source: 'ai_generated'
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast.success('Rezeptur gespeichert');
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    }
  });

  // ── Helpers ──
  const addComponent = (name: string, type: RecipeComponent["type"]) => {
    if (!name.trim() || components.find(c => c.name === name)) return;
    setComponents([...components, { id: `comp_${Date.now()}`, name, type, concentration: 0 }]);
  };

  const updateConcentration = (id: string, value: number) => {
    setComponents(components.map(c => c.id === id ? { ...c, concentration: value } : c));
  };

  const removeComponent = (id: string) => {
    setComponents(components.filter(c => c.id !== id));
  };

  const totalConcentration = components.reduce((s, c) => s + c.concentration, 0);
  const isBalanced = Math.abs(totalConcentration - 100) < 0.5;

  const currentStepIdx = STEPS.findIndex(s => s.id === wizardStep);

  const loadSampleData = (sample: any) => {
    if (!sample.sample_results?.length) {
      toast.error('Keine Laborergebnisse für diese Probe');
      return;
    }
    const resultsText = sample.sample_results
      .map((r: any) => `${r.parameter_name}: ${r.parameter_value}${r.unit ? ` ${r.unit}` : ''}`)
      .join('\n');
    setDatasheetText(resultsText);
    setMaterialContext(`Material: ${sample.material_input?.material_type || 'Unbekannt'}, Lieferant: ${sample.material_input?.supplier || 'Unbekannt'}`);
    setActiveView("wizard");
    setWizardStep("analysis");
    toast.success('Probendaten geladen');
  };

  const resetWizard = () => {
    setRecipeName("");
    setRecipeDescription("");
    setComponents([]);
    setProcessTemp("");
    setProcessPressure("");
    setProcessThroughput("");
    setProcessNotes("");
    setDatasheetText("");
    setMaterialContext("");
    setAnalysisResult(null);
    setWizardStep("recipe");
  };

  // ── RENDER ──
  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">

        {/* ── LIST VIEW ── */}
        {activeView === "list" && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <FlaskConical className="h-6 w-6 text-primary" />
                  Rezepturentwicklung
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {recipes?.length ?? 0} Rezepturen gespeichert
                </p>
              </div>
              <Button onClick={() => { resetWizard(); setActiveView("wizard"); }} className="gap-2">
                <Plus className="w-4 h-4" /> Neue Analyse
              </Button>
            </div>

            <Tabs defaultValue="recipes" className="space-y-4">
              <TabsList>
                <TabsTrigger value="recipes" className="gap-2">
                  <Beaker className="h-4 w-4" />
                  Rezepturen ({recipes?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="samples" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Laborproben
                </TabsTrigger>
              </TabsList>

              <TabsContent value="recipes">
                {recipes?.length ? (
                  <div className="space-y-3">
                    {recipes.map((recipe) => {
                      const hasComposition = !!recipe.material_composition;
                      return (
                        <button
                          key={recipe.id}
                          onClick={() => { setSelectedRecipe(recipe); setActiveView("detail"); }}
                          className="block w-full text-left group"
                        >
                          <Card className="hover:shadow-md transition-all border-border group-hover:border-primary/30">
                            <CardContent className="p-5">
                              <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-xl flex-shrink-0 ${hasComposition ? "bg-primary/10" : "bg-muted"}`}>
                                  <FlaskConical className={`w-5 h-5 ${hasComposition ? "text-primary" : "text-muted-foreground"}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-foreground truncate">{recipe.name}</h3>
                                  {recipe.description && (
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">{recipe.description}</p>
                                  )}
                                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                    {recipe.applications?.slice(0, 3).map((app: string, idx: number) => (
                                      <span key={idx} className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                                        {app}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {recipe.confidence_score && (
                                    <Badge variant="default" className="font-mono text-xs">
                                      {Math.round(Number(recipe.confidence_score) * 100)}%
                                    </Badge>
                                  )}
                                  <Badge variant="outline" className="text-xs">{recipe.source}</Badge>
                                  <span className="text-xs text-muted-foreground font-mono">
                                    {new Date(recipe.created_at).toLocaleDateString("de-DE")}
                                  </span>
                                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <Card className="border-dashed border-border">
                    <CardContent className="p-12 text-center">
                      <FlaskConical className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                      <p className="font-medium text-foreground">Noch keine Rezepturen vorhanden</p>
                      <p className="text-sm text-muted-foreground mt-1 mb-4">Erstelle deine erste Compound-Analyse</p>
                      <Button onClick={() => { resetWizard(); setActiveView("wizard"); }} className="gap-2">
                        <Plus className="w-4 h-4" /> Jetzt starten
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="samples">
                <Card>
                  <CardHeader>
                    <CardTitle>Abgeschlossene Laborproben</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {samplesWithResults?.length ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Probe-ID</TableHead>
                            <TableHead>Material</TableHead>
                            <TableHead>Lieferant</TableHead>
                            <TableHead>Ergebnisse</TableHead>
                            <TableHead>Datum</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {samplesWithResults.map((sample: any) => (
                            <TableRow key={sample.id}>
                              <TableCell className="font-mono">{sample.sample_id}</TableCell>
                              <TableCell>{sample.material_input?.material_type || '-'}</TableCell>
                              <TableCell>{sample.material_input?.supplier || '-'}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{sample.sample_results?.length || 0} Parameter</Badge>
                              </TableCell>
                              <TableCell>
                                {sample.analyzed_at ? new Date(sample.analyzed_at).toLocaleDateString('de-DE') : '-'}
                              </TableCell>
                              <TableCell>
                                <Button size="sm" variant="outline" onClick={() => loadSampleData(sample)}>
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  Analysieren
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-center py-8 text-muted-foreground">
                        Keine abgeschlossenen Proben vorhanden
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* ── DETAIL VIEW ── */}
        {activeView === "detail" && selectedRecipe && (
          <>
            <div className="flex items-start gap-3">
              <Button variant="ghost" size="icon" onClick={() => setActiveView("list")} className="mt-0.5">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-foreground">{selectedRecipe.name}</h1>
                {selectedRecipe.description && (
                  <p className="text-sm text-muted-foreground mt-0.5">{selectedRecipe.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {selectedRecipe.confidence_score && (
                    <Badge variant="default" className="font-mono">
                      {Math.round(Number(selectedRecipe.confidence_score) * 100)}% Konfidenz
                    </Badge>
                  )}
                  <Badge variant="outline">{selectedRecipe.source}</Badge>
                </div>
              </div>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview" className="gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Übersicht
                </TabsTrigger>
                <TabsTrigger value="properties" className="gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" /> Eigenschaften
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Zusammensetzung</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedRecipe.material_composition ? (
                        <div className="space-y-2 text-sm">
                          {Object.entries(selectedRecipe.material_composition as Record<string, string>).map(([key, value]) => (
                            <div key={key} className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
                              <span className="text-muted-foreground">{key}</span>
                              <span className="font-mono text-foreground">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Keine Zusammensetzung hinterlegt</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Anwendungen</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedRecipe.applications?.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedRecipe.applications.map((app: string, idx: number) => (
                            <Badge key={idx} variant="secondary">{app}</Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Keine Anwendungen definiert</p>
                      )}
                      {selectedRecipe.recommended_for?.length > 0 && (
                        <div className="mt-4">
                          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Empfohlen für</p>
                          <div className="flex flex-wrap gap-2">
                            {selectedRecipe.recommended_for.map((r: string, idx: number) => (
                              <Badge key={idx} variant="outline">{r}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="properties">
                <Card>
                  <CardContent className="p-6">
                    {selectedRecipe.target_properties ? (
                      <div className="space-y-2 text-sm">
                        {Object.entries(selectedRecipe.target_properties as Record<string, string>).map(([key, value]) => (
                          value && (
                            <div key={key} className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
                              <span className="text-muted-foreground">{key.replace(/_/g, ' ')}</span>
                              <span className="font-mono text-foreground">{String(value)}</span>
                            </div>
                          )
                        ))}
                      </div>
                    ) : (
                      <p className="text-center py-8 text-muted-foreground">Keine Eigenschaften vorhanden</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* ── WIZARD VIEW ── */}
        {activeView === "wizard" && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setActiveView("list")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-foreground">Neue Compound-Analyse</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Rezeptur eingeben und KI-Analyse starten
                </p>
              </div>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center gap-2">
              {STEPS.map((s, index) => {
                const isActive = s.id === wizardStep;
                const isDone = currentStepIdx > index;
                const Icon = s.icon;
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    <button
                      onClick={() => setWizardStep(s.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : isDone
                          ? "bg-green-500/10 text-green-700"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {isDone ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                      {s.label}
                    </button>
                    {index < STEPS.length - 1 && (
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Step Content */}
            <Card>
              {/* ── STEP: RECIPE ── */}
              {wizardStep === "recipe" && (
                <>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FlaskConical className="w-5 h-5 text-primary" />
                      Compound-Rezeptur
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <Label className="text-xs text-muted-foreground">Name der Rezeptur *</Label>
                      <Input
                        value={recipeName}
                        onChange={(e) => setRecipeName(e.target.value)}
                        placeholder="z.B. PP-GF30 Automotive"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Beschreibung</Label>
                      <Textarea
                        value={recipeDescription}
                        onChange={(e) => setRecipeDescription(e.target.value)}
                        placeholder="Kurze Beschreibung..."
                        rows={2}
                        className="mt-1 resize-none"
                      />
                    </div>

                    {/* Concentration Balance */}
                    {components.length > 0 && (
                      <div className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium border ${
                        isBalanced
                          ? "bg-green-500/10 text-green-700 border-green-500/20"
                          : "bg-amber-500/10 text-amber-700 border-amber-500/20"
                      }`}>
                        <span>Gesamtkonzentration</span>
                        <span className="font-mono">
                          {totalConcentration.toFixed(1)} Gew.-%{" "}
                          {isBalanced ? "✓" : `(${(100 - totalConcentration).toFixed(1)}% fehlen)`}
                        </span>
                      </div>
                    )}

                    {/* Components */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-foreground">Basispolymere & Additive</h3>
                        <Badge variant="outline">{components.length} Komponenten</Badge>
                      </div>

                      {components.map((comp) => (
                        <div key={comp.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg mb-2 border border-border">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{comp.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{comp.type}</p>
                          </div>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={comp.concentration}
                            onChange={(e) => updateConcentration(comp.id, parseFloat(e.target.value) || 0)}
                            className="w-20 text-right font-mono h-8"
                          />
                          <span className="text-xs text-muted-foreground w-12">Gew.-%</span>
                          <Button
                            variant="ghost" size="sm"
                            className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                            onClick={() => removeComponent(comp.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}

                      {/* Add polymer */}
                      <select
                        onChange={(e) => { if (e.target.value) { addComponent(e.target.value, "polymer"); e.target.value = ""; }}}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground mt-2"
                        defaultValue=""
                      >
                        <option value="" disabled>Polymer auswählen...</option>
                        {MATERIAL_TYPES.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>

                      {/* Add additive */}
                      <select
                        onChange={(e) => { if (e.target.value) { addComponent(e.target.value, "additive"); e.target.value = ""; }}}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground mt-2"
                        defaultValue=""
                      >
                        <option value="" disabled>Additiv auswählen...</option>
                        {ADDITIVE_TYPES.map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>

                      {/* Custom */}
                      <div className="flex gap-2 mt-2">
                        <Input
                          value={newComponentName}
                          onChange={(e) => setNewComponentName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { addComponent(newComponentName, "additive"); setNewComponentName(""); }}}
                          placeholder="Eigene Komponente eingeben..."
                          className="flex-1"
                        />
                        <Button size="sm" variant="outline" disabled={!newComponentName.trim()}
                          onClick={() => { addComponent(newComponentName, "additive"); setNewComponentName(""); }}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </>
              )}

              {/* ── STEP: PROCESS ── */}
              {wizardStep === "process" && (
                <>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Settings className="w-5 h-5 text-primary" />
                      Verarbeitungsparameter
                      <span className="text-sm font-normal text-muted-foreground">(optional)</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Temperatur (°C)</Label>
                        <Input
                          type="number" value={processTemp}
                          onChange={(e) => setProcessTemp(e.target.value)}
                          placeholder="z.B. 230"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Druck (bar)</Label>
                        <Input
                          type="number" value={processPressure}
                          onChange={(e) => setProcessPressure(e.target.value)}
                          placeholder="z.B. 80"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Durchsatz (kg/h)</Label>
                        <Input
                          type="number" value={processThroughput}
                          onChange={(e) => setProcessThroughput(e.target.value)}
                          placeholder="z.B. 500"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Verarbeitungshinweise</Label>
                      <Textarea
                        value={processNotes}
                        onChange={(e) => setProcessNotes(e.target.value)}
                        placeholder="z.B. Vortrocknung 4h bei 80°C empfohlen..."
                        rows={3}
                        className="mt-1 resize-none"
                      />
                    </div>
                  </CardContent>
                </>
              )}

              {/* ── STEP: ANALYSIS ── */}
              {wizardStep === "analysis" && (
                <>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Sparkles className="w-5 h-5 text-primary" />
                      KI-Analyse
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Materialkontext (optional)</Label>
                      <Input
                        placeholder="z.B. PP-GF30 von Lieferant XY"
                        value={materialContext}
                        onChange={(e) => setMaterialContext(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Datenblatt / Laborergebnisse (optional)</Label>
                      <Textarea
                        placeholder={"Fügen Sie hier Materialeigenschaften ein...\n\nBeispiel:\nZugfestigkeit: 85 MPa\nE-Modul: 8500 MPa\nSchlagzähigkeit: 12 kJ/m²"}
                        value={datasheetText}
                        onChange={(e) => setDatasheetText(e.target.value)}
                        className="min-h-[150px] font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Auftrag zuordnen (optional)</Label>
                      <Select value={selectedOrder} onValueChange={setSelectedOrder}>
                        <SelectTrigger>
                          <SelectValue placeholder="Auftrag auswählen..." />
                        </SelectTrigger>
                        <SelectContent>
                          {orders?.map((order) => (
                            <SelectItem key={order.id} value={order.id}>
                              {order.order_id} - {order.customer_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Analysis button */}
                    <Button
                      onClick={() => analyzeMutation.mutate()}
                      disabled={(!datasheetText.trim() && components.length === 0) || isAnalyzing}
                      className="w-full"
                    >
                      {isAnalyzing ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> KI analysiert...</>
                      ) : (
                        <><Zap className="h-4 w-4 mr-2" /> KI-Analyse starten</>
                      )}
                    </Button>

                    {/* Results */}
                    {analysisResult && (
                      <div className="space-y-4 pt-4 border-t">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium text-foreground">Analyseergebnis</h3>
                          {analysisResult.confidence && (
                            <Badge variant="default" className="font-mono">
                              {Math.round(analysisResult.confidence * 100)}% Konfidenz
                            </Badge>
                          )}
                        </div>

                        <div className="p-3 bg-muted rounded-lg">
                          <h4 className="font-semibold">{analysisResult.material_type}</h4>
                          {analysisResult.material_grade && (
                            <p className="text-sm text-muted-foreground">{analysisResult.material_grade}</p>
                          )}
                        </div>

                        {analysisResult.summary && (
                          <div>
                            <h4 className="font-medium mb-1">Zusammenfassung</h4>
                            <p className="text-sm text-muted-foreground">{analysisResult.summary}</p>
                          </div>
                        )}

                        {analysisResult.properties && (
                          <div>
                            <h4 className="font-medium mb-2">Eigenschaften</h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              {Object.entries(analysisResult.properties).map(([key, value]) => (
                                value && (
                                  <div key={key} className="flex justify-between py-1 border-b border-border/50">
                                    <span className="text-muted-foreground">{key.replace(/_/g, ' ')}</span>
                                    <span className="font-mono">{value as string}</span>
                                  </div>
                                )
                              ))}
                            </div>
                          </div>
                        )}

                        {analysisResult.suggested_recipes?.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2 flex items-center gap-2">
                              <Lightbulb className="w-4 h-4 text-primary" />
                              Vorgeschlagene Rezepturen
                            </h4>
                            <div className="space-y-2">
                              {analysisResult.suggested_recipes.map((recipe: any, idx: number) => (
                                <Card key={idx} className="border-border">
                                  <CardContent className="p-4">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <p className="font-medium">{recipe.name}</p>
                                        <p className="text-xs text-muted-foreground">{recipe.description}</p>
                                      </div>
                                      <Badge variant={recipe.match_score > 0.8 ? "default" : "secondary"}>
                                        {Math.round((recipe.match_score || 0.7) * 100)}%
                                      </Badge>
                                    </div>
                                    <div className="flex gap-2 mt-3">
                                      <Button size="sm" variant="outline" onClick={() => saveRecipeMutation.mutate(recipe)}>
                                        <CheckCircle className="h-3 w-3 mr-1" /> Speichern
                                      </Button>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>
                        )}

                        {analysisResult.applications?.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">Empfohlene Anwendungen</h4>
                            <div className="flex flex-wrap gap-2">
                              {analysisResult.applications.map((app: any, idx: number) => (
                                <Badge key={idx} variant="outline">
                                  {app.name} ({app.industry})
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </>
              )}

              {/* Navigation */}
              <div className="flex justify-between px-6 pb-6 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (currentStepIdx > 0) setWizardStep(STEPS[currentStepIdx - 1].id);
                  }}
                  disabled={currentStepIdx === 0}
                >
                  Zurück
                </Button>
                {wizardStep !== "analysis" ? (
                  <Button
                    onClick={() => setWizardStep(STEPS[currentStepIdx + 1].id)}
                    disabled={wizardStep === "recipe" && !recipeName.trim()}
                  >
                    Weiter →
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      saveRecipeMutation.mutate({
                        name: recipeName,
                        description: recipeDescription,
                        match_score: analysisResult?.confidence,
                      });
                      setActiveView("list");
                    }}
                    disabled={!recipeName.trim()}
                  >
                    Speichern & Fertig
                  </Button>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
