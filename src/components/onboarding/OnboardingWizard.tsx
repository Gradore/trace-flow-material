import { useState, useEffect } from "react";
import { Building2, Cog, ClipboardList, ChevronRight, ChevronLeft, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface OnboardingWizardProps {
  open: boolean;
  onClose: () => void;
}

const steps = [
  {
    id: 1,
    title: "Firma anlegen",
    description: "Legen Sie Ihre Kunden und Lieferanten als Firmenkontakte an. Diese werden für Aufträge, Lieferscheine und die Materialverfolgung benötigt.",
    icon: Building2,
    link: "/companies",
    linkText: "Firmen verwalten",
  },
  {
    id: 2,
    title: "Maschine/Anlage hinzufügen",
    description: "Fügen Sie Ihre Produktionsanlagen und Maschinen hinzu, um Wartungen zu planen und die Verarbeitung zu dokumentieren.",
    icon: Cog,
    link: "/maintenance",
    linkText: "Anlagen verwalten",
  },
  {
    id: 3,
    title: "Ersten Auftrag erstellen",
    description: "Erstellen Sie Ihren ersten Kundenauftrag mit Produktspezifikationen, Mengen und Lieferterminen.",
    icon: ClipboardList,
    link: "/orders",
    linkText: "Aufträge verwalten",
  },
];

export function OnboardingWizard({ open, onClose }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleNavigate = (link: string) => {
    onClose();
    navigate(link);
  };

  const handleDontShowAgain = () => {
    localStorage.setItem("onboarding_completed", "true");
    onClose();
  };

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">Willkommen bei RecyTrack!</DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription>
            Folgen Sie dieser kurzen Einführung, um die wichtigsten Funktionen kennenzulernen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Schritt {currentStep + 1} von {steps.length}</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Step Indicators */}
          <div className="flex justify-center gap-2">
            {steps.map((s, index) => (
              <button
                key={s.id}
                onClick={() => setCurrentStep(index)}
                className={cn(
                  "h-2 w-8 rounded-full transition-colors",
                  index === currentStep
                    ? "bg-primary"
                    : index < currentStep
                    ? "bg-primary/50"
                    : "bg-muted"
                )}
              />
            ))}
          </div>

          {/* Current Step Content */}
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <step.icon className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="text-muted-foreground mt-2">{step.description}</p>
            </div>
            <Button
              variant="outline"
              onClick={() => handleNavigate(step.link)}
              className="mt-2"
            >
              {step.linkText}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="ghost"
            onClick={handleDontShowAgain}
            className="text-muted-foreground"
          >
            Nicht mehr anzeigen
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handlePrev}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Zurück
            </Button>
            {currentStep === steps.length - 1 ? (
              <Button onClick={handleDontShowAgain}>
                <Check className="h-4 w-4 mr-1" />
                Fertig
              </Button>
            ) : (
              <Button onClick={handleNext}>
                Weiter
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
