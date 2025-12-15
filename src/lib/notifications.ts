import { supabase } from "@/integrations/supabase/client";

type NotificationType = "info" | "warning" | "success" | "error";

interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
  relatedId?: string;
}

export async function createNotification({
  userId,
  title,
  message,
  type = "info",
  link,
  relatedId,
}: CreateNotificationParams) {
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    title,
    message,
    type,
    link,
    related_id: relatedId,
  });

  if (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
}

// Predefined notification creators for common events
export const notificationTemplates = {
  sampleApproved: (userId: string, sampleId: string, sampleName: string) =>
    createNotification({
      userId,
      title: "Probe freigegeben",
      message: `Probe ${sampleName} wurde erfolgreich freigegeben.`,
      type: "success",
      link: "/sampling",
      relatedId: sampleId,
    }),

  sampleRejected: (userId: string, sampleId: string, sampleName: string) =>
    createNotification({
      userId,
      title: "Probe abgelehnt",
      message: `Probe ${sampleName} wurde abgelehnt. Bitte prüfen Sie die Ergebnisse.`,
      type: "error",
      link: "/sampling",
      relatedId: sampleId,
    }),

  orderCreated: (userId: string, orderId: string, customerName: string) =>
    createNotification({
      userId,
      title: "Neuer Auftrag",
      message: `Neuer Auftrag für ${customerName} wurde erstellt.`,
      type: "info",
      link: "/orders",
      relatedId: orderId,
    }),

  orderStatusChanged: (userId: string, orderId: string, orderRef: string, newStatus: string) =>
    createNotification({
      userId,
      title: "Auftragsstatus geändert",
      message: `Auftrag ${orderRef} wurde auf "${newStatus}" gesetzt.`,
      type: "info",
      link: "/orders",
      relatedId: orderId,
    }),

  deadlineApproaching: (userId: string, orderId: string, orderRef: string, daysLeft: number) =>
    createNotification({
      userId,
      title: "Frist läuft ab",
      message: `Auftrag ${orderRef} muss in ${daysLeft} Tag${daysLeft > 1 ? "en" : ""} produziert werden.`,
      type: "warning",
      link: "/orders",
      relatedId: orderId,
    }),

  materialReceived: (userId: string, inputId: string, supplier: string) =>
    createNotification({
      userId,
      title: "Material eingegangen",
      message: `Neues Material von ${supplier} wurde erfasst.`,
      type: "info",
      link: "/intake",
      relatedId: inputId,
    }),

  processingCompleted: (userId: string, processingId: string, stepName: string) =>
    createNotification({
      userId,
      title: "Verarbeitung abgeschlossen",
      message: `Verarbeitungsschritt "${stepName}" wurde abgeschlossen.`,
      type: "success",
      link: "/processing",
      relatedId: processingId,
    }),
};
