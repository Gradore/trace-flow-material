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
 * Build the URL that a printed QR code points at.
 *
 * There are no detail routes such as /containers/:id in the app, so encoding
 * one would send every scan to the 404 page. The scanner page at /scan resolves
 * a code passed as a query parameter and shows the record.
 */
function buildScanUrl(code: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/scan?code=${encodeURIComponent(code)}`;
}

/**
 * Build a QR code URL for a container
 */
export function buildContainerQRUrl(containerId: string): string {
  return buildScanUrl(containerId);
}

/**
 * Build a QR code URL for a material input
 */
export function buildMaterialInputQRUrl(inputId: string): string {
  return buildScanUrl(inputId);
}

/**
 * Build a QR code URL for an output material
 */
export function buildOutputMaterialQRUrl(outputId: string): string {
  return buildScanUrl(outputId);
}

/**
 * Build a QR code URL for a batch/delivery note
 */
export function buildDeliveryNoteQRUrl(noteId: string): string {
  return buildScanUrl(noteId);
}
