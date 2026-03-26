
import React, { useState } from 'react';
import { getInventoryInsights } from '../services/geminiService';
import { Device } from '../types';

interface GeminiAssistantProps {
  devices: Device[];
}

const GeminiAssistant: React.FC<GeminiAssistantProps> = ({ devices }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsLoading(true);
    const result = await getInventoryInsights(devices, query);
    setResponse(result);
    setIsLoading(false);
  };

  return (
    <div className={`fixed bottom-6 right-6 z-40 flex flex-col items-end transition-all ${isOpen ? 'w-80' : 'w-12'}`}>
      {isOpen && (
        <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-2xl shadow-2xl mb-4 overflow-hidden flex flex-col h-96 w-full">
          <div className="p-4 bg-primary text-white flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">auto_awesome</span>
              <span className="text-xs font-bold uppercase tracking-wider">Asistente IA</span>
            </div>
            <button onClick={() => setIsOpen(false)}>
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {response ? (
              <div className="bg-slate-50 dark:bg-background-dark/30 p-3 rounded-xl border border-slate-200 dark:border-border-dark text-xs leading-relaxed italic">
                {response}
              </div>
            ) : (
              <div className="text-slate-400 text-xs italic text-center mt-10">
                Pregúntame algo sobre el inventario...<br/>
                <span className="text-[10px] opacity-60">"¿Qué marca es más común?" o "¿Resumen de activos?"</span>
              </div>
            )}
            {isLoading && (
              <div className="flex items-center gap-2 text-primary">
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            )}
          </div>

          <form onSubmit={handleAsk} className="p-3 border-t border-slate-200 dark:border-border-dark flex gap-2">
            <input
              className="flex-1 bg-slate-100 dark:bg-background-dark border-none rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-primary"
              placeholder="Escribe tu duda..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading}
              className="w-8 h-8 bg-primary text-white rounded-lg flex items-center justify-center disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">send</span>
            </button>
          </form>
        </div>
      )}
      
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 ${
          isOpen ? 'bg-slate-200 dark:bg-border-dark text-slate-600' : 'bg-primary text-white'
        }`}
      >
        <span className="material-symbols-outlined">{isOpen ? 'chat_bubble' : 'auto_awesome'}</span>
      </button>
    </div>
  );
};

export default GeminiAssistant;
