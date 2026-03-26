
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Device, DeviceType } from '../types';

interface SmartScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResult: (data: any) => void;
  devices: Device[];
}

const SmartScannerModal: React.FC<SmartScannerModalProps> = ({ isOpen, onClose, onResult, devices }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("No se pudo acceder a la cámara. Por favor, verifica los permisos.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const analyzeImage = async (base64Image: string) => {
    setIsScanning(true);
    setError(null);

    try {
      const knownBrands = Array.from(new Set(devices.map(d => d.brand))).filter(Boolean).join(', ');
      const knownModels = Array.from(new Set(devices.map(d => d.model))).filter(Boolean).join(', ');

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            {
              text: `Actúa como un experto en gestión de activos IT. Analiza la imagen de la etiqueta del equipo y extrae la información técnica exacta.
              
              Contexto de inventario actual (usa esto para normalizar nombres si hay coincidencias cercanas):
              Marcas conocidas: ${knownBrands}
              Modelos conocidos: ${knownModels}
              
              Instrucciones críticas:
              1. Busca el campo marcado como 'PN' o 'Part Number'. Extrae el código alfanumérico completo que aparece a su derecha (ej: G59P9IGE19XBXX5FXS30). Este valor debe ir ÚNICAMENTE en el campo "pn".
              2. Busca el campo marcado como 'SERIE' o 'S/N'. Extrae el código alfanumérico completo (ej: AR020001660090).
              3. Extrae la Marca (ej: BANGHO), Modelo (ej: BES PRO T5 i7), Procesador, RAM y Almacenamiento de las especificaciones listadas.
              4. IMPORTANTE: No incluyas el Part Number (PN) dentro de los campos de procesador, ram, almacenamiento o modelo.
              
              Devuelve EXCLUSIVAMENTE un objeto JSON con esta estructura:
              {
                "marca": string,
                "modelo": string,
                "procesador": string,
                "almacenamiento": string,
                "ram": string,
                "pn": string,
                "serie": string
              }
              
              Si un valor no es visible, usa null. No incluyas markdown ni texto adicional.`
            },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image
              }
            }
          ]
        },
        config: {
          responseMimeType: "application/json"
        }
      });

      const resultText = response.text;
      if (resultText) {
        const data = JSON.parse(resultText);
        onResult(data);
      } else {
        throw new Error("No se pudo extraer información de la imagen.");
      }
    } catch (err: any) {
      console.error("Error analyzing image:", err);
      setError(err.message || "Error al procesar la imagen.");
    } finally {
      setIsScanning(false);
    }
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not get canvas context");
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL('image/jpeg').split(',')[1];
      await analyzeImage(base64Image);
    } catch (err: any) {
      setError(err.message || "Error al capturar la imagen.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      const base64Image = result.split(',')[1];
      await analyzeImage(base64Image);
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-surface-dark w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-border-dark overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200 dark:border-border-dark flex justify-between items-center bg-slate-50 dark:bg-background-dark/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined">auto_awesome</span>
            </div>
            <div>
              <h2 className="text-lg font-bold">Escaneo Inteligente</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">IA + Visión Artificial</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-primary transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <div className="p-6 flex flex-col items-center">
          <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border-2 border-slate-100 dark:border-border-dark">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
            
            {isScanning && (
              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-sm font-bold uppercase tracking-widest animate-pulse">Analizando con IA...</p>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl flex items-start gap-3 w-full">
              <span className="material-symbols-outlined text-rose-500">error</span>
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{error}</p>
            </div>
          )}

          <div className="mt-6 p-4 bg-primary/5 rounded-xl border border-primary/10 flex items-start gap-3 w-full">
            <span className="material-symbols-outlined text-primary text-xl">lightbulb</span>
            <p className="text-xs text-primary font-medium leading-relaxed">
              Encuadra la etiqueta del equipo (S/N, Specs, QR) y presiona el botón para que la IA extraiga los datos automáticamente.
            </p>
          </div>
        </div>

        <div className="p-6 bg-slate-50 dark:bg-background-dark/20 border-t border-slate-200 dark:border-border-dark flex flex-wrap justify-between gap-3">
          <div className="flex gap-3">
            <button 
              onClick={onClose} 
              className="px-6 py-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark text-slate-600 dark:text-slate-300 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all"
            >
              Cancelar
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanning}
              className="px-6 py-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark text-primary rounded-lg text-sm font-bold hover:bg-slate-50 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-lg">upload_file</span>
              Subir Imagen
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileUpload}
            />
          </div>
          <button 
            onClick={captureAndAnalyze}
            disabled={isScanning || !stream}
            className="flex-1 flex items-center justify-center gap-2 bg-primary text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined">camera</span>
            Capturar y Procesar
          </button>
        </div>
      </div>
    </div>
  );
};

export default SmartScannerModal;
