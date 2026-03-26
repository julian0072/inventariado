
import React, { useState, useRef } from 'react';
import { Device, DeviceStatus, DeviceType, Attachment } from '../types';

interface AddDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (device: Omit<Device, 'id' | 'lastUpdated' | 'createdAt' | 'logs'>) => void;
  initialShelfTag?: string;
  prefilledData?: Partial<Device>;
}

const AREAS = ['DGTAS', 'JEFATURA', 'SSCTAL', 'DGASJU'];
const SECTORES = ['GO Lgal', 'Go Gestion y Regitracion de contrataciones', 'OGESE', 'GO Compras y Contrataciones', 'GOSIMA', 'GO RRHH'];
const PISOS = ['1', '2'];

const AddDeviceModal: React.FC<AddDeviceModalProps> = ({ isOpen, onClose, onAdd, initialShelfTag = '', prefilledData }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [customType, setCustomType] = useState('');
  const [formData, setFormData] = useState({
    serialNumber: '',
    shelfTag: initialShelfTag,
    type: DeviceType.NOTEBOOK,
    brand: '',
    model: '',
    location: 'Oficina',
    status: DeviceStatus.FUNCIONA,
    assignedUser: '',
    comments: '',
    description: '',
    area: AREAS[0],
    sector: SECTORES[0],
    piso: PISOS[0],
    puesto: '',
    warrantyUntil: ''
  });

  const resetForm = () => {
    setCustomType('');
    setFormData({
      serialNumber: '',
      shelfTag: initialShelfTag,
      type: DeviceType.NOTEBOOK,
      brand: '',
      model: '',
      location: 'Oficina',
      status: DeviceStatus.FUNCIONA,
      assignedUser: '',
      comments: '',
      description: '',
      area: AREAS[0],
      sector: SECTORES[0],
      piso: PISOS[0],
      puesto: '',
      warrantyUntil: ''
    });
    setAttachments([]);
  };

  React.useEffect(() => {
    if (isOpen) {
      if (prefilledData) {
        setFormData({
          serialNumber: prefilledData.serialNumber || '',
          shelfTag: prefilledData.shelfTag || '',
          brand: prefilledData.brand || '',
          model: prefilledData.model || '',
          description: prefilledData.description || '',
          type: prefilledData.type || DeviceType.NOTEBOOK,
          location: 'Oficina',
          status: DeviceStatus.FUNCIONA,
          assignedUser: '',
          comments: '',
          area: AREAS[0],
          sector: SECTORES[0],
          piso: PISOS[0],
          puesto: '',
          warrantyUntil: ''
        });
      } else {
        resetForm();
      }
    }
  }, [isOpen, initialShelfTag, prefilledData]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newAttachment: Attachment = {
          name: file.name,
          data: reader.result as string,
          date: new Date().toISOString().split('T')[0]
        };
        setAttachments(prev => [...prev, newAttachment]);
      };
      reader.readAsDataURL(file);
    }
  };

  const sanitizeInput = (val: string) => val.replace(/-/g, '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      ...formData,
      type: formData.type === DeviceType.OTRO ? customType as DeviceType : formData.type,
      serialNumber: sanitizeInput(formData.serialNumber),
      shelfTag: sanitizeInput(formData.shelfTag),
      attachments,
      assignedUserInitials: formData.assignedUser ? formData.assignedUser.trim().split(' ').map(n => n[0]).join('').toUpperCase() : null
    });
    onClose();
    resetForm();
  };

  const inputClasses = "w-full bg-slate-100 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary outline-none transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-surface-dark w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-border-dark overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-200 dark:border-border-dark flex justify-between items-center bg-slate-50 dark:bg-background-dark/20">
          <h2 className="text-xl font-bold">Nuevo Ingreso de Inventario</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-primary transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} autoComplete="off" className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
          {/* Dummy inputs to catch autofill */}
          <input type="text" style={{ display: 'none' }} tabIndex={-1} />
          <input type="password" style={{ display: 'none' }} tabIndex={-1} />
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">Número de Serie</label>
              <input 
                name="serial_num_field_unique"
                autoComplete="new-password"
                required 
                className={inputClasses} 
                value={formData.serialNumber} 
                onChange={e => setFormData({ ...formData, serialNumber: e.target.value })} 
                placeholder="S/N" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">Ficha de Estante</label>
              <input 
                name="shelf_tag_field_unique"
                autoComplete="new-password"
                required 
                className={inputClasses} 
                value={formData.shelfTag} 
                onChange={e => setFormData({ ...formData, shelfTag: e.target.value })} 
                placeholder="Ficha" 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">Tipo de Activo</label>
              <select className={inputClasses} value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as DeviceType })}>
                <option value={DeviceType.NOTEBOOK} className="dark:bg-surface-dark">{DeviceType.NOTEBOOK}</option>
                <option value={DeviceType.CPU} className="dark:bg-surface-dark">{DeviceType.CPU}</option>
                <option value={DeviceType.MONITOR} className="dark:bg-surface-dark">{DeviceType.MONITOR}</option>
                <option value={DeviceType.OTRO} className="dark:bg-surface-dark">{DeviceType.OTRO}</option>
              </select>
            </div>
            {formData.type === DeviceType.OTRO && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Especificar Tipo</label>
                <input 
                  required 
                  className={inputClasses} 
                  value={customType} 
                  onChange={e => setCustomType(e.target.value)} 
                  placeholder="Ej: Impresora, Scanner..." 
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">Estado Inicial</label>
              <select className={inputClasses} value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as DeviceStatus })}>
                {Object.values(DeviceStatus).map(s => <option key={s} value={s} className="dark:bg-surface-dark">{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-border-dark pt-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">Marca</label>
              <input 
                name="brand_field_unique"
                autoComplete="new-password"
                required 
                className={inputClasses} 
                value={formData.brand} 
                onChange={e => setFormData({ ...formData, brand: e.target.value })} 
                placeholder="Ej: Dell, Logitech..." 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">Modelo</label>
              <input 
                name="model_field_unique"
                autoComplete="new-password"
                required 
                className={inputClasses} 
                value={formData.model} 
                onChange={e => setFormData({ ...formData, model: e.target.value })} 
                placeholder="Modelo específico" 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">Área</label>
              <select className={inputClasses} value={formData.area} onChange={e => setFormData({ ...formData, area: e.target.value })}>
                {AREAS.map(a => <option key={a} value={a} className="dark:bg-surface-dark">{a}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">Sector</label>
              <select className={inputClasses} value={formData.sector} onChange={e => setFormData({ ...formData, sector: e.target.value })}>
                {SECTORES.map(s => <option key={s} value={s} className="dark:bg-surface-dark">{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">Ubicación</label>
              <select className={inputClasses} value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })}>
                <option value="Oficina" className="dark:bg-surface-dark">Oficina</option>
                <option value="Home" className="dark:bg-surface-dark">Home</option>
                <option value="Deposito" className="dark:bg-surface-dark">Deposito</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">Responsable</label>
              <input 
                name="responsible_field_unique"
                autoComplete="new-password"
                className={inputClasses} 
                value={formData.assignedUser} 
                onChange={e => setFormData({ ...formData, assignedUser: e.target.value })} 
                placeholder="Nombre del responsable" 
                maxLength={30}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">Garantía hasta</label>
              <input type="date" className={inputClasses} value={formData.warrantyUntil} onChange={e => setFormData({ ...formData, warrantyUntil: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-500">Notas de Ingreso</label>
            <textarea className={inputClasses + " min-h-[80px] resize-none"} value={formData.comments} onChange={e => setFormData({ ...formData, comments: e.target.value })} placeholder="Comentarios adicionales..." />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-500">Descripción del equipo</label>
            <textarea className={inputClasses + " min-h-[80px] resize-none"} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Especificaciones, detalles técnicos, etc." />
          </div>

          <div className="pt-4 flex gap-3 shrink-0">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-border-dark text-sm font-semibold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">Cancelar</button>
            <button type="submit" className="flex-1 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-primary/20 transition-all">Registrar Activo</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddDeviceModal;
