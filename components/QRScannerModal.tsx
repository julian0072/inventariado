
import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
}

const QRScannerModal: React.FC<QRScannerModalProps> = ({ isOpen, onClose, onScan }) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Delay initialization slightly to ensure the container is rendered
      const timer = setTimeout(() => {
        scannerRef.current = new Html5QrcodeScanner(
          "qr-reader",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          /* verbose= */ false
        );

        scannerRef.current.render(
          (decodedText) => {
            onScan(decodedText);
            if (scannerRef.current) {
              scannerRef.current.clear().catch(err => console.error("Failed to clear scanner", err));
            }
          },
          (errorMessage) => {
            // Error callback is called frequently, usually safe to ignore
          }
        );
      }, 100);

      return () => {
        clearTimeout(timer);
        if (scannerRef.current) {
          scannerRef.current.clear().catch(err => console.error("Failed to clear scanner during cleanup", err));
        }
      };
    }
  }, [isOpen, onScan]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-surface-dark w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-border-dark overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200 dark:border-border-dark flex justify-between items-center bg-slate-50 dark:bg-background-dark/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined">qr_code_scanner</span>
            </div>
            <div>
              <h2 className="text-lg font-bold">Escanear Ficha</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Apunta a un código QR</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-primary transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <div className="p-6">
          <div id="qr-reader" className="overflow-hidden rounded-xl border-2 border-slate-100 dark:border-border-dark"></div>
          <div className="mt-6 p-4 bg-primary/5 rounded-xl border border-primary/10 flex items-start gap-3">
            <span className="material-symbols-outlined text-primary text-xl">info</span>
            <p className="text-xs text-primary font-medium leading-relaxed">
              Escanea el código QR de la ficha de estante para buscar el equipo o iniciar un nuevo ingreso con los datos precargados.
            </p>
          </div>
        </div>

        <div className="p-6 bg-slate-50 dark:bg-background-dark/20 border-t border-slate-200 dark:border-border-dark flex justify-end">
          <button 
            onClick={onClose} 
            className="px-6 py-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark text-slate-600 dark:text-slate-300 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default QRScannerModal;
