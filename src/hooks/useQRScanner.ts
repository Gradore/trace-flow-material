import { useState, useCallback, useRef, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface UseQRScannerOptions {
  onScanSuccess?: (decodedText: string) => void;
  onScanError?: (error: string) => void;
}

interface UseQRScannerReturn {
  isScanning: boolean;
  error: string | null;
  startScanning: (elementId: string) => Promise<void>;
  stopScanning: () => Promise<void>;
  lastResult: string | null;
}

export function useQRScanner(options: UseQRScannerOptions = {}): UseQRScannerReturn {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const stopScanning = useCallback(async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
        scannerRef.current = null;
        setIsScanning(false);
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
  }, [isScanning]);

  const startScanning = useCallback(async (elementId: string) => {
    if (scannerRef.current) {
      await stopScanning();
    }

    try {
      setError(null);
      const html5QrCode = new Html5Qrcode(elementId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          setLastResult(decodedText);
          options.onScanSuccess?.(decodedText);
        },
        (errorMessage) => {
          // Ignore frequent scan errors (no QR code in view)
          if (!errorMessage.includes('No QR code found')) {
            options.onScanError?.(errorMessage);
          }
        }
      );

      setIsScanning(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Kamera konnte nicht gestartet werden';
      setError(errorMessage);
      options.onScanError?.(errorMessage);
    }
  }, [options, stopScanning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  return {
    isScanning,
    error,
    startScanning,
    stopScanning,
    lastResult,
  };
}

/**
 * Parse a RecyTrack QR code URL to extract the type and ID
 */
export function parseRecyTrackQRCode(url: string): { type: string; id: string } | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    
    if (pathParts.length >= 2) {
      return {
        type: pathParts[0],
        id: pathParts[1],
      };
    }
    
    // Handle direct IDs (e.g., BB-2024-0001)
    const idMatch = url.match(/(BB|GX|BX|ME|VRB|PRB|OUT|LS)-\d{4}-\d{4}/);
    if (idMatch) {
      const prefix = idMatch[1];
      const typeMap: Record<string, string> = {
        BB: 'containers',
        GX: 'containers',
        BX: 'containers',
        ME: 'intake',
        VRB: 'processing',
        PRB: 'sampling',
        OUT: 'output',
        LS: 'delivery-notes',
      };
      return {
        type: typeMap[prefix] || 'unknown',
        id: idMatch[0],
      };
    }
    
    return null;
  } catch {
    // Try to parse as direct ID
    const idMatch = url.match(/(BB|GX|BX|ME|VRB|PRB|OUT|LS)-\d{4}-\d{4}/);
    if (idMatch) {
      const prefix = idMatch[1];
      const typeMap: Record<string, string> = {
        BB: 'containers',
        GX: 'containers',
        BX: 'containers',
        ME: 'intake',
        VRB: 'processing',
        PRB: 'sampling',
        OUT: 'output',
        LS: 'delivery-notes',
      };
      return {
        type: typeMap[prefix] || 'unknown',
        id: idMatch[0],
      };
    }
    return null;
  }
}
