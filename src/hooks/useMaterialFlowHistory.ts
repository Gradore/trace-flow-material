import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Json } from "@/integrations/supabase/types";

type EventType = 
  | 'intake_received'
  | 'container_assigned'
  | 'processing_started'
  | 'processing_completed'
  | 'sample_created'
  | 'sample_analyzed'
  | 'sample_approved'
  | 'sample_rejected'
  | 'output_created'
  | 'delivery_note_created'
  | 'document_uploaded';

interface LogEventParams {
  eventType: EventType;
  eventDescription: string;
  eventDetails?: Json;
  materialInputId?: string;
  containerId?: string;
  processingStepId?: string;
  sampleId?: string;
  outputMaterialId?: string;
  deliveryNoteId?: string;
}

export function useMaterialFlowHistory() {
  const { user } = useAuth();

  const logEvent = async ({
    eventType,
    eventDescription,
    eventDetails,
    materialInputId,
    containerId,
    processingStepId,
    sampleId,
    outputMaterialId,
    deliveryNoteId,
  }: LogEventParams) => {
    try {
      const { error } = await supabase.from('material_flow_history').insert({
        event_type: eventType,
        event_description: eventDescription,
        event_details: eventDetails || {},
        material_input_id: materialInputId || null,
        container_id: containerId || null,
        processing_step_id: processingStepId || null,
        sample_id: sampleId || null,
        output_material_id: outputMaterialId || null,
        delivery_note_id: deliveryNoteId || null,
        created_by: user?.id || null,
      });

      if (error) {
        console.error('Error logging event:', error);
      }
    } catch (err) {
      console.error('Error logging event:', err);
    }
  };

  return { logEvent };
}
