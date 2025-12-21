import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  XCircle,
  Loader2,
  Package,
  Beaker,
  Target
} from "lucide-react";

export default function RecipeMatching() {
  const queryClient = useQueryClient();
  const [datasheetText, setDatasheetText] = useState("");
  const [materialContext, setMaterialContext] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  // Fetch orders for assignment
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

  // Fetch samples with results for analysis
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

  // Analyze datasheet mutation
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      setIsAnalyzing(true);
      const { data, error } = await supabase.functions.invoke('analyze-datasheet', {
        body: {
          datasheetText,
          materialContext,
          analysisType: 'recipe_matching'
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setAnalysisResult(data.result);
      toast.success('Analyse abgeschlossen');
    },
    onError: (error) => {
      toast.error(`Analyse fehlgeschlagen: ${error.message}`);
    },
    onSettled: () => {
      setIsAnalyzing(false);
    }
  });

  // Save recipe mutation
  const saveRecipeMutation = useMutation({
    mutationFn: async (recipe: any) => {
      const { data: recipeId } = await supabase.rpc('generate_unique_id', { prefix: 'REZ' });
      
      const { error } = await supabase
        .from('recipes')
        .insert({
          recipe_id: recipeId,
          name: recipe.name,
          description: recipe.description,
          material_composition: analysisResult?.composition,
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

  // Assign to order mutation
  const assignToOrderMutation = useMutation({
    mutationFn: async ({ orderId, recipeId, applicationId, matchScore, matchReason }: any) => {
      const { error } = await supabase
        .from('order_recipe_matches')
        .insert({
          order_id: orderId,
          recipe_id: recipeId,
          application_id: applicationId,
          match_score: matchScore,
          match_reason: matchReason,
          status: 'suggested'
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Zuordnung gespeichert');
      queryClient.invalidateQueries({ queryKey: ['order-matches'] });
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    }
  });

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
    toast.success('Probendaten geladen');
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
              <FlaskConical className="h-7 w-7 text-primary" />
              KI Rezeptur-Matching
            </h1>
            <p className="text-muted-foreground mt-1">
              Analysiere Datenblätter und finde passende Rezepturen für Aufträge
            </p>
          </div>
        </div>

        <Tabs defaultValue="analyze" className="space-y-4">
          <TabsList>
            <TabsTrigger value="analyze" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Analysieren
            </TabsTrigger>
            <TabsTrigger value="recipes" className="gap-2">
              <Beaker className="h-4 w-4" />
              Rezepturen ({recipes?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="samples" className="gap-2">
              <FileText className="h-4 w-4" />
              Laborproben
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analyze" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Input Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Datenblatt / Laborergebnisse
                  </CardTitle>
                  <CardDescription>
                    Fügen Sie die Materialdaten ein oder laden Sie eine Probe
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Materialkontext (optional)</Label>
                    <Input
                      placeholder="z.B. PP-GF30 von Lieferant XY"
                      value={materialContext}
                      onChange={(e) => setMaterialContext(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Datenblatt / Laborergebnisse</Label>
                    <Textarea
                      placeholder="Fügen Sie hier die Materialeigenschaften ein...&#10;&#10;Beispiel:&#10;Zugfestigkeit: 85 MPa&#10;E-Modul: 8500 MPa&#10;Schlagzähigkeit: 12 kJ/m²&#10;Dichte: 1.23 g/cm³"
                      value={datasheetText}
                      onChange={(e) => setDatasheetText(e.target.value)}
                      className="min-h-[200px] font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Auftrag zuordnen (optional)</Label>
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
                  <Button 
                    onClick={() => analyzeMutation.mutate()}
                    disabled={!datasheetText.trim() || isAnalyzing}
                    className="w-full"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Analysiere...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Mit KI analysieren
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Results Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Analyse-Ergebnis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analysisResult ? (
                    <div className="space-y-4">
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
                                <div key={key} className="flex justify-between">
                                  <span className="text-muted-foreground">{key.replace(/_/g, ' ')}:</span>
                                  <span>{value as string}</span>
                                </div>
                              )
                            ))}
                          </div>
                        </div>
                      )}

                      {analysisResult.suggested_recipes?.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">Vorgeschlagene Rezepturen</h4>
                          <div className="space-y-2">
                            {analysisResult.suggested_recipes.map((recipe: any, idx: number) => (
                              <div key={idx} className="p-2 border rounded-lg">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium">{recipe.name}</p>
                                    <p className="text-xs text-muted-foreground">{recipe.description}</p>
                                  </div>
                                  <Badge variant={recipe.match_score > 0.8 ? "default" : "secondary"}>
                                    {Math.round((recipe.match_score || 0.7) * 100)}%
                                  </Badge>
                                </div>
                                <div className="flex gap-2 mt-2">
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => saveRecipeMutation.mutate(recipe)}
                                  >
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Speichern
                                  </Button>
                                  {selectedOrder && (
                                    <Button 
                                      size="sm"
                                      onClick={() => assignToOrderMutation.mutate({
                                        orderId: selectedOrder,
                                        matchScore: recipe.match_score,
                                        matchReason: recipe.reason
                                      })}
                                    >
                                      Zuordnen
                                    </Button>
                                  )}
                                </div>
                              </div>
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
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FlaskConical className="h-12 w-12 mx-auto mb-2 opacity-20" />
                      <p>Führen Sie eine Analyse durch, um Ergebnisse zu sehen</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="recipes">
            <Card>
              <CardHeader>
                <CardTitle>Gespeicherte Rezepturen</CardTitle>
              </CardHeader>
              <CardContent>
                {recipes?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Beschreibung</TableHead>
                        <TableHead>Quelle</TableHead>
                        <TableHead>Konfidenz</TableHead>
                        <TableHead>Erstellt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recipes.map((recipe) => (
                        <TableRow key={recipe.id}>
                          <TableCell className="font-mono">{recipe.recipe_id}</TableCell>
                          <TableCell className="font-medium">{recipe.name}</TableCell>
                          <TableCell className="max-w-xs truncate">{recipe.description}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{recipe.source}</Badge>
                          </TableCell>
                          <TableCell>
                            {recipe.confidence_score 
                              ? `${Math.round(Number(recipe.confidence_score) * 100)}%` 
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {new Date(recipe.created_at).toLocaleDateString('de-DE')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center py-8 text-muted-foreground">
                    Noch keine Rezepturen gespeichert
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="samples">
            <Card>
              <CardHeader>
                <CardTitle>Abgeschlossene Laborproben</CardTitle>
                <CardDescription>
                  Klicken Sie auf eine Probe, um deren Ergebnisse zu analysieren
                </CardDescription>
              </CardHeader>
              <CardContent>
                {samplesWithResults?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Proben-ID</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead>Lieferant</TableHead>
                        <TableHead>Ergebnisse</TableHead>
                        <TableHead>Analysiert am</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {samplesWithResults.map((sample) => (
                        <TableRow key={sample.id}>
                          <TableCell className="font-mono">{sample.sample_id}</TableCell>
                          <TableCell>{sample.material_input?.material_type || '-'}</TableCell>
                          <TableCell>{sample.material_input?.supplier || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {sample.sample_results?.length || 0} Parameter
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {sample.analyzed_at 
                              ? new Date(sample.analyzed_at).toLocaleDateString('de-DE')
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => loadSampleData(sample)}
                            >
                              Laden
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
      </div>
    </AppLayout>
  );
}
