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

const describeError = (err: unknown, fallback: string): string => {
  if (err instanceof Error) return err.message;
  // html5-qrcode rejects/throws plain strings in several places
  if (typeof err === 'string' && err.trim()) return err;
  return fallback;
};

export function useQRScanner(options: UseQRScannerOptions = {}): UseQRScannerReturn {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  // html5-qrcode's stop() throws synchronously when the camera never started,
  // so the running state is tracked in a ref instead of the (async) state value.
  const runningRef = useRef(false);
  // start() receives the callbacks once; reading them from a ref keeps them
  // from going stale for the rest of the scanning session.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const stopScanning = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;

    const wasRunning = runningRef.current;
    scannerRef.current = null;
    runningRef.current = false;
    setIsScanning(false);

    try {
      if (wasRunning) {
        await scanner.stop();
      }
      scanner.clear();
    } catch (err) {
      console.error('Error stopping scanner:', err);
    }
  }, []);

  const startScanning = useCallback(async (elementId: string) => {
    await stopScanning();

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
          optionsRef.current.onScanSuccess?.(decodedText);
        },
        (errorMessage) => {
          // Ignore frequent scan errors (no QR code in view)
          if (!errorMessage.includes('No QR code found')) {
            optionsRef.current.onScanError?.(errorMessage);
          }
        }
      );

      runningRef.current = true;
      setIsScanning(true);
    } catch (err) {
      // The camera never came up - drop the instance so the next attempt starts clean
      const scanner = scannerRef.current;
      scannerRef.current = null;
      runningRef.current = false;
      setIsScanning(false);
      try {
        scanner?.clear();
      } catch {
        // element was never populated
      }

      const errorMessage = describeError(err, 'Kamera konnte nicht gestartet werden');
      setError(errorMessage);
      optionsRef.current.onScanError?.(errorMessage);
    }
  }, [stopScanning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (!scanner || !runningRef.current) return;

      runningRef.current = false;
      try {
        scanner.stop().catch((err) => console.error('Error stopping scanner:', err));
      } catch (err) {
        // stop() throws synchronously when the scanner is not running
        console.error('Error stopping scanner:', err);
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
 * Prefixes handed to the generate_unique_id RPC across the app, mapped to the
 * record type the scanner resolves them against.
 */
const PREFIX_TYPE_MAP: Record<string, string> = {
  BB: 'containers',
  BX: 'containers',
  GX: 'containers',
  CT: 'containers',
  ME: 'intake',
  VRB: 'processing',
  PRB: 'sampling',
  RST: 'sampling',
  OUT: 'output',
  AUS: 'output',
  LS: 'delivery',
};

const ID_PATTERN = new RegExp(`(${Object.keys(PREFIX_TYPE_MAP).join('|')})-\\d{4}-\\d{4}`);

/**
 * Path segments used by QR codes printed before the /scan resolver existed,
 * normalised to the record types above.
 */
const PATH_TYPE_MAP: Record<string, string> = {
  containers: 'containers',
  intake: 'intake',
  'material-intake': 'intake',
  processing: 'processing',
  sampling: 'sampling',
  'retention-samples': 'sampling',
  output: 'output',
  'output-materials': 'output',
  delivery: 'delivery',
  'delivery-notes': 'delivery',
};

function parseDirectId(value: string): { type: string; id: string } | null {
  const idMatch = value.match(ID_PATTERN);
  if (!idMatch) return null;

  return {
    type: PREFIX_TYPE_MAP[idMatch[1]] || 'unknown',
    id: idMatch[0],
  };
}

/**
 * Parse a RekuFLOW QR code URL to extract the type and ID
 */
export function parseRekuFLOWQRCode(url: string): { type: string; id: string } | null {
  try {
    const urlObj = new URL(url);

    // Current QR codes point at /scan?code=<id>
    const code = urlObj.searchParams.get('code');
    if (code) {
      return parseDirectId(code);
    }

    // Legacy QR codes point at /<type>/<id>
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    if (pathParts.length >= 2) {
      const type = PATH_TYPE_MAP[pathParts[0]];
      if (type) {
        return { type, id: decodeURIComponent(pathParts[1]) };
      }
    }

    return parseDirectId(url);
  } catch {
    // Not a URL - try to parse as direct ID (e.g., BB-2024-0001)
    return parseDirectId(url);
  }
}
