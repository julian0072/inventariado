
import React, { useState, useEffect, useRef } from 'react';
import { Device, DeviceStatus, DeviceType, Attachment, DeviceLog } from '../types';

interface DeviceDetailModalProps {
  device: Device | null;
  onClose: () => void;
  onUpdate: (deviceId: string, updates: Partial<Device>) => void;
  onDelete?: (deviceId: string) => void;
  canEdit?: boolean;
}

const AREAS = ['DGTAS', 'JEFATURA', 'SSCTAL', 'DGASJU'];
const SECTORES = ['GO Lgal', 'Go Gestion y Regitracion de contrataciones', 'OGESE', 'GO Compras y Contrataciones', 'GOSIMA', 'GO RRHH'];
const PISOS = ['1', '2'];
const LOCATIONS = ['Deposito', 'Home', 'Oficina', 'Remoto'];

const DeviceDetailModal: React.FC<DeviceDetailModalProps> = ({ device, onClose, onUpdate, onDelete, canEdit = true }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<Partial<Device>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeView, setActiveView] = useState<'info' | 'logs'>('info');
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

  useEffect(() => {
    if (device) {
      setFormData({
        area: device.area,
        sector: device.sector,
        piso: device.piso,
        puesto: device.puesto,
        status: device.status,
        location: device.location,
        assignedUser: device.assignedUser || '',
        comments: device.comments || '',
        description: device.description || '',
        attachments: [...(device.attachments || [])],
        warrantyUntil: device.warrantyUntil || ''
      });
      setIsEditing(false);
    }
  }, [device]);

  if (!device) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newAtt: Attachment = {
          name: file.name,
          data: reader.result as string,
          date: new Date().toISOString().split('T')[0]
        };
        const updatedAttachments = [...(formData.attachments || []), newAtt];
        setFormData(prev => ({ ...prev, attachments: updatedAttachments }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    setIsSaving(true);
    let updates = { ...formData };
    if (formData.assignedUser !== device.assignedUser) {
      updates.assignedUserInitials = formData.assignedUser 
        ? formData.assignedUser.trim().split(' ').map(n => n[0]).join('').toUpperCase() 
        : null;
    }
    onUpdate(device.id, updates);
    setTimeout(() => {
      setIsSaving(false);
      setIsEditing(false);
    }, 600);
  };

  const handleChange = (field: keyof Device, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const openAttachment = (att: Attachment) => {
    if (att.data.startsWith('data:image/')) {
      setPreviewAttachment(att);
      return;
    }
    if (att.data === 'mock_base64') { alert("Archivo de prueba."); return; }
    try {
      const base64Parts = att.data.split(',');
      const mime = base64Parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
      const b64Data = base64Parts[1];
      const byteCharacters = atob(b64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {type: mime});
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) { alert("No se pudo abrir."); }
  };

  const selectClasses = "w-full bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none transition-all cursor-pointer appearance-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-surface-dark w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-border-dark overflow-hidden flex flex-col max-h-[90vh] relative">
        {/* Attachment Preview Overlay */}
        {previewAttachment && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="relative max-w-full w-full max-h-full flex flex-col items-center">
              <button 
                onClick={() => setPreviewAttachment(null)}
                className="absolute top-0 right-0 text-white hover:text-primary transition-colors flex items-center gap-2 font-black uppercase text-[10px] tracking-widest p-2"
              >
                Cerrar <span className="material-symbols-outlined text-sm">close</span>
              </button>
              <img 
                src={previewAttachment.data} 
                alt={previewAttachment.name} 
                className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-2xl border border-white/10"
                referrerPolicy="no-referrer"
              />
              <div className="mt-4 text-center">
                <p className="text-white font-bold text-xs">{previewAttachment.name}</p>
                <p className="text-white/50 text-[8px] font-bold uppercase tracking-widest mt-1">{previewAttachment.date}</p>
                <button 
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = previewAttachment.data;
                    link.download = previewAttachment.name;
                    link.click();
                  }}
                  className="mt-3 px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full text-[9px] font-black uppercase tracking-widest transition-all border border-white/10"
                >
                  Descargar
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-border-dark flex justify-between items-center bg-slate-50 dark:bg-background-dark/20 shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined">edit_note</span>
             </div>
             <div>
                <h2 className="text-lg font-bold">Detalle del Equipo</h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">S/N: {device.serialNumber}</p>
             </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex bg-slate-200/50 dark:bg-border-dark p-1 rounded-lg">
                <button onClick={() => setActiveView('info')} className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${activeView === 'info' ? 'bg-white dark:bg-surface-dark shadow-sm' : 'text-slate-500'}`}>Info</button>
                <button onClick={() => setActiveView('logs')} className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${activeView === 'logs' ? 'bg-white dark:bg-surface-dark shadow-sm' : 'text-slate-500'}`}>Logs</button>
             </div>
             {activeView === 'info' && canEdit && (
               <button 
                 onClick={() => setIsEditing(!isEditing)} 
                 className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${isEditing ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
               >
                 <span className="material-symbols-outlined text-sm">{isEditing ? 'close' : 'edit'}</span>
                 {isEditing ? 'Cancelar' : 'Editar'}
               </button>
             )}
             <button onClick={onClose} className="text-slate-400 hover:text-primary transition-colors"><span className="material-symbols-outlined">close</span></button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          {/* Dummy inputs to catch autofill */}
          <input type="text" style={{ display: 'none' }} tabIndex={-1} />
          <input type="password" style={{ display: 'none' }} tabIndex={-1} />
          
          {activeView === 'info' ? (
            <>
              <div className="grid grid-cols-2 gap-x-8 pb-4 border-b border-slate-100 dark:border-border-dark">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Tipo de Activo</label>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{device.type} - {device.brand} {device.model}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Ficha Técnica</label>
                  <p className="font-mono text-sm font-bold text-slate-500">{device.shelfTag}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Estado</label>
                  {isEditing ? (
                    <div className="relative">
                      <select className={selectClasses} value={formData.status || ''} onChange={(e) => handleChange('status', e.target.value)}>
                        {Object.values(DeviceStatus).map(s => <option key={s} value={s} className="dark:bg-surface-dark">{s}</option>)}
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm">expand_more</span>
                    </div>
                  ) : (
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{formData.status}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Ubicación</label>
                  {isEditing ? (
                    <div className="relative">
                      <select className={selectClasses} value={formData.location || ''} onChange={(e) => handleChange('location', e.target.value)}>
                        {LOCATIONS.map(l => <option key={l} value={l} className="dark:bg-surface-dark">{l}</option>)}
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm">expand_more</span>
                    </div>
                  ) : (
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{formData.location}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Área</label>
                  {isEditing ? (
                    <div className="relative">
                      <select className={selectClasses} value={formData.area || ''} onChange={(e) => handleChange('area', e.target.value)}>
                        {AREAS.map(a => <option key={a} value={a} className="dark:bg-surface-dark">{a}</option>)}
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm">expand_more</span>
                    </div>
                  ) : (
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{formData.area}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Sector</label>
                  {isEditing ? (
                    <div className="relative">
                      <select className={selectClasses} value={formData.sector || ''} onChange={(e) => handleChange('sector', e.target.value)}>
                        {SECTORES.map(s => <option key={s} value={s} className="dark:bg-surface-dark">{s}</option>)}
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm">expand_more</span>
                    </div>
                  ) : (
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{formData.sector}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Garantía hasta</label>
                  {isEditing ? (
                    <div className="relative">
                      <input type="date" className={selectClasses} value={formData.warrantyUntil || ''} onChange={(e) => handleChange('warrantyUntil', e.target.value)} />
                    </div>
                  ) : (
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{formData.warrantyUntil || 'Sin fecha'}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-border-dark">
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Usuario Responsable</label>
                {isEditing ? (
                  <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">person</span>
                      <input 
                        name="edit_responsible_field_unique"
                        autoComplete="new-password"
                        className="w-full bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl pl-9 pr-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none" 
                        value={formData.assignedUser || ''} 
                        onChange={(e) => handleChange('assignedUser', e.target.value)} 
                        placeholder="Nombre del responsable" 
                        maxLength={30}
                      />
                  </div>
                ) : (
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{formData.assignedUser || 'Sin asignar'}</p>
                )}
              </div>

              <div className="space-y-3 pt-4">
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Documentación Adjunta</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {formData.attachments?.map((att, i) => (
                    <div key={i} onClick={() => openAttachment(att)} className="flex items-center justify-between bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark p-3 rounded-xl cursor-pointer hover:border-primary/50 transition-all">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="material-symbols-outlined text-primary text-sm">visibility</span>
                        <div className="overflow-hidden">
                            <p className="text-[10px] font-bold truncate pr-1">{att.name}</p>
                            <p className="text-[8px] text-slate-400 font-bold uppercase">{att.date}</p>
                        </div>
                      </div>
                      {isEditing && (
                        <button onClick={(e) => { e.stopPropagation(); setFormData(prev => ({ ...prev, attachments: prev.attachments?.filter((_, idx) => idx !== i) })); }} className="text-slate-400 hover:text-rose-500 transition-colors p-1"><span className="material-symbols-outlined text-sm">delete</span></button>
                      )}
                    </div>
                  ))}
                  {isEditing && (
                    <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-200 dark:border-border-dark rounded-xl p-3 flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                      <span className="material-symbols-outlined text-slate-400 text-sm">add_circle</span>
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Añadir</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-border-dark">
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Descripción del equipo</label>
                {isEditing ? (
                  <textarea className="w-full bg-slate-50 dark:bg-surface-dark p-4 rounded-xl border border-slate-200 dark:border-border-dark min-h-[100px] text-sm focus:ring-1 focus:ring-primary outline-none transition-all" value={formData.description || ''} onChange={(e) => handleChange('description', e.target.value)} placeholder="Especificaciones técnicas..." />
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{formData.description || 'Sin descripción'}</p>
                )}
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-border-dark">
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Observaciones Generales</label>
                {isEditing ? (
                  <textarea className="w-full bg-slate-50 dark:bg-surface-dark p-4 rounded-xl border border-slate-200 dark:border-border-dark min-h-[100px] text-sm focus:ring-1 focus:ring-primary outline-none transition-all" value={formData.comments || ''} onChange={(e) => handleChange('comments', e.target.value)} placeholder="Notas internas..." />
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{formData.comments || 'Sin observaciones'}</p>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-4">
               <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Historial de Actividades</h3>
               <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100 dark:before:bg-border-dark">
                  {device.logs.length > 0 ? [...device.logs].reverse().map((log, i) => (
                    <div key={i} className="relative group">
                       <div className="absolute -left-[1.625rem] top-1.5 w-3 h-3 rounded-full bg-white dark:bg-surface-dark border-2 border-primary"></div>
                       <div className="bg-slate-50 dark:bg-background-dark/20 p-3 rounded-xl border border-slate-100 dark:border-border-dark">
                          <div className="flex justify-between items-start mb-1">
                             <div className="flex flex-col">
                               <span className="text-[10px] font-black uppercase text-primary">{log.action}</span>
                               {log.performedBy && <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Por: {log.performedBy}</span>}
                             </div>
                             <span className="text-[9px] font-bold text-slate-400">{log.date}</span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">{log.details}</p>
                       </div>
                    </div>
                  )) : <div className="text-center py-10 opacity-50"><p className="text-xs">Sin registros.</p></div>}
               </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 dark:bg-background-dark/20 border-t border-slate-200 dark:border-border-dark flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Modificado: {device.lastUpdated}</p>
            {canEdit && onDelete && (
              <button 
                onClick={() => onDelete(device.id)}
                className="flex items-center gap-1 text-rose-500 hover:text-rose-600 transition-colors text-[10px] font-bold uppercase tracking-widest ml-4"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
                Eliminar Equipo
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-6 py-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark text-slate-600 dark:text-slate-300 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all">Cerrar</button>
            {activeView === 'info' && isEditing && (
                <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50">
                    {isSaving ? <span className="material-symbols-outlined animate-spin text-sm">sync</span> : <span className="material-symbols-outlined text-sm">check</span>}
                    {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeviceDetailModal;
