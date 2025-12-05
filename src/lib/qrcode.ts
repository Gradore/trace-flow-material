import QRCode from 'qrcode';

export interface QRCodeOptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
}

/**
 * Generate a QR code as a data URL (base64 image)
 */
export async function generateQRCodeDataURL(
  data: string,
  options: QRCodeOptions = {}
): Promise<string> {
  const defaultOptions = {
    width: 200,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
    ...options,
  };

  try {
    const dataUrl = await QRCode.toDataURL(data, defaultOptions);
    return dataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
}

/**
 * Generate a QR code as SVG string
 */
export async function generateQRCodeSVG(
  data: string,
  options: QRCodeOptions = {}
): Promise<string> {
  const defaultOptions = {
    width: 200,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
    ...options,
  };

  try {
    const svg = await QRCode.toString(data, { ...defaultOptions, type: 'svg' });
    return svg;
  } catch (error) {
    console.error('Error generating QR code SVG:', error);
    throw error;
  }
}

/**
 * Build a QR code URL for a container
 */
export function buildContainerQRUrl(containerId: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/containers/${containerId}`;
}

/**
 * Build a QR code URL for a material input
 */
export function buildMaterialInputQRUrl(inputId: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/intake/${inputId}`;
}

/**
 * Build a QR code URL for an output material
 */
export function buildOutputMaterialQRUrl(outputId: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/output/${outputId}`;
}

/**
 * Build a QR code URL for a batch/delivery note
 */
export function buildDeliveryNoteQRUrl(noteId: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/delivery-notes/${noteId}`;
}
