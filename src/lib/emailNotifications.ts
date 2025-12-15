import { supabase } from '@/integrations/supabase/client';

type NotificationType = 
  | 'sample_approved' 
  | 'sample_rejected' 
  | 'order_created' 
  | 'deadline_approaching' 
  | 'registration_approved' 
  | 'registration_rejected' 
  | 'pickup_request' 
  | 'announcement'
  | 'general';

interface SendEmailParams {
  to: string;
  subject: string;
  title: string;
  message: string;
  link?: string;
  type: NotificationType;
}

export async function sendNotificationEmail({ to, subject, title, message, link, type }: SendEmailParams) {
  try {
    const { data, error } = await supabase.functions.invoke('send-notification-email', {
      body: { to, subject, title, message, link, type },
    });

    if (error) {
      console.error('Error sending notification email:', error);
      return { success: false, error };
    }

    console.log('Email sent successfully:', data);
    return { success: true, data };
  } catch (err) {
    console.error('Error sending notification email:', err);
    return { success: false, error: err };
  }
}

// Pre-built email templates
export const emailTemplates = {
  sampleApproved: (sampleId: string, materialType: string, recipientEmail: string, baseUrl: string) => ({
    to: recipientEmail,
    subject: `Probe ${sampleId} genehmigt`,
    title: 'Probe genehmigt',
    message: `Die Probe ${sampleId} für Material "${materialType}" wurde erfolgreich von der Qualitätssicherung genehmigt. Das Material kann nun für die Produktion freigegeben werden.`,
    link: `${baseUrl}/sampling`,
    type: 'sample_approved' as NotificationType,
  }),

  sampleRejected: (sampleId: string, materialType: string, reason: string, recipientEmail: string, baseUrl: string) => ({
    to: recipientEmail,
    subject: `Probe ${sampleId} abgelehnt`,
    title: 'Probe abgelehnt',
    message: `Die Probe ${sampleId} für Material "${materialType}" wurde abgelehnt. Grund: ${reason}. Bitte überprüfen Sie das Material und erstellen Sie ggf. eine neue Probe.`,
    link: `${baseUrl}/sampling`,
    type: 'sample_rejected' as NotificationType,
  }),

  orderCreated: (orderId: string, customerName: string, productName: string, recipientEmail: string, baseUrl: string) => ({
    to: recipientEmail,
    subject: `Neuer Auftrag ${orderId}`,
    title: 'Neuer Auftrag erstellt',
    message: `Ein neuer Auftrag ${orderId} wurde von ${customerName} erstellt. Produkt: ${productName}. Bitte überprüfen Sie die Details und planen Sie die Produktion.`,
    link: `${baseUrl}/orders`,
    type: 'order_created' as NotificationType,
  }),

  deadlineApproaching: (orderId: string, deadline: string, daysRemaining: number, recipientEmail: string, baseUrl: string) => ({
    to: recipientEmail,
    subject: `Deadline-Warnung: Auftrag ${orderId}`,
    title: 'Deadline nähert sich',
    message: `Der Auftrag ${orderId} hat eine Deadline am ${deadline}. Es verbleiben noch ${daysRemaining} Tag(e). Bitte stellen Sie sicher, dass die Produktion rechtzeitig abgeschlossen wird.`,
    link: `${baseUrl}/orders`,
    type: 'deadline_approaching' as NotificationType,
  }),

  registrationApproved: (userName: string, role: string, recipientEmail: string, baseUrl: string) => ({
    to: recipientEmail,
    subject: 'Registrierung genehmigt - RecyTrack',
    title: 'Willkommen bei RecyTrack!',
    message: `Hallo ${userName}, Ihre Registrierung als "${role}" wurde genehmigt. Sie können sich jetzt mit Ihren Zugangsdaten anmelden und RecyTrack nutzen.`,
    link: `${baseUrl}/auth`,
    type: 'registration_approved' as NotificationType,
  }),

  registrationRejected: (userName: string, reason: string, recipientEmail: string) => ({
    to: recipientEmail,
    subject: 'Registrierung abgelehnt - RecyTrack',
    title: 'Registrierung nicht genehmigt',
    message: `Hallo ${userName}, Ihre Registrierung wurde leider nicht genehmigt. Grund: ${reason}. Bei Fragen wenden Sie sich bitte an den Administrator.`,
    type: 'registration_rejected' as NotificationType,
  }),

  pickupRequest: (requestId: string, companyName: string, materialDescription: string, recipientEmail: string, baseUrl: string) => ({
    to: recipientEmail,
    subject: `Neue Abholanfrage ${requestId}`,
    title: 'Neue Abholanfrage',
    message: `${companyName} hat eine neue Abholanfrage (${requestId}) erstellt. Material: ${materialDescription}. Bitte planen Sie die Abholung.`,
    link: `${baseUrl}/logistics`,
    type: 'pickup_request' as NotificationType,
  }),

  materialAnnouncement: (announcementId: string, companyName: string, materialType: string, recipientEmail: string, baseUrl: string) => ({
    to: recipientEmail,
    subject: `Neue Materialankündigung ${announcementId}`,
    title: 'Neue Materialankündigung',
    message: `${companyName} hat eine neue Materialankündigung (${announcementId}) erstellt. Material: ${materialType}. Bitte überprüfen und bestätigen Sie die Anlieferung.`,
    link: `${baseUrl}/supplier-portal`,
    type: 'announcement' as NotificationType,
  }),
};
