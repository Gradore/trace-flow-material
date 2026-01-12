import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

export default function ServerError() {
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-2xl">500 - Serverfehler</CardTitle>
          <CardDescription>
            Ein unerwarteter Fehler ist aufgetreten. Wir arbeiten daran, das Problem zu beheben.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Bitte versuchen Sie es in einigen Minuten erneut. 
            Falls das Problem weiterhin besteht, kontaktieren Sie bitte unseren Support.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={handleReload} variant="default">
              <RefreshCw className="mr-2 h-4 w-4" />
              Erneut versuchen
            </Button>
            <Link to="/">
              <Button variant="outline" className="w-full">
                <Home className="mr-2 h-4 w-4" />
                Zur Startseite
              </Button>
            </Link>
          </div>
          
          <p className="text-xs text-muted-foreground pt-4">
            Support: info@gradore.de
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
