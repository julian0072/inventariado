
import React, { useState, useMemo, useEffect, useRef, Component } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Sidebar from './components/Sidebar';
import AddDeviceModal from './components/AddDeviceModal';
import DeviceDetailModal from './components/DeviceDetailModal';
import AddUserModal from './components/AddUserModal';
import QRScannerModal from './components/QRScannerModal';
import SmartScannerModal from './components/SmartScannerModal';
import Login from './components/Login';
import { Device, DeviceStatus, DeviceType, InventoryStats, DeviceLog, User, UserRole } from './types';
import { INITIAL_DEVICES, REQUESTED_DEVICES } from './mockData';
import { db, auth } from './firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  getDoc,
  writeBatch,
  getDocFromServer
} from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();

const sanitizeForFirestore = (obj: any): any => {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForFirestore(item));
  }

  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    const val = obj[key];
    if (val !== undefined) {
      newObj[key] = sanitizeForFirestore(val);
    }
  });
  return newObj;
};

type SortConfig = {
  key: keyof Device | 'assignedUser';
  direction: 'asc' | 'desc';
} | null;

const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "Eliminar", 
  confirmColor = "bg-rose-500" 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void; 
  title: string; 
  message: string; 
  confirmText?: string; 
  confirmColor?: string;
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-surface-dark w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-border-dark overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <h3 className="text-lg font-bold mb-2">{title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-background-dark/20 border-t border-slate-200 dark:border-border-dark flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors">Cancelar</button>
          <button onClick={() => { onConfirm(); onClose(); }} className={`px-4 py-2 text-sm font-bold text-white ${confirmColor} rounded-lg shadow-lg transition-all hover:opacity-90`}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

const getStatusStyle = (status: DeviceStatus) => {
  switch (status) {
    case DeviceStatus.FUNCIONA: return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    case DeviceStatus.NO_FUNCIONA: return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
    case DeviceStatus.DADO_DE_BAJA: return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
  }
};

const SortButton = ({ column, label, sortConfig, toggleSort }: { column: keyof Device | 'assignedUser', label: string, sortConfig: SortConfig, toggleSort: (key: keyof Device | 'assignedUser') => void }) => {
  const isActive = sortConfig?.key === column;
  return (
    <button onClick={(e) => { e.stopPropagation(); toggleSort(column); }} className="flex items-center gap-1 hover:text-primary transition-colors uppercase whitespace-nowrap">
      {label} <span className="material-symbols-outlined text-[14px]">{isActive ? (sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'swap_vert'}</span>
    </button>
  );
};

interface DeviceTableProps {
  paginatedDevices: Device[];
  selectedDeviceIds: string[];
  setSelectedDeviceIds: React.Dispatch<React.SetStateAction<string[]>>;
  currentUser: User | null;
  setSelectedDevice: (device: Device | null) => void;
  handleBulkDelete: () => void;
  handleBulkUpdate: (updates: Partial<Device>) => void;
  toggleSort: (key: keyof Device | 'assignedUser') => void;
  sortConfig: SortConfig;
  totalPages: number;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  allFilteredDevicesCount: number;
  startDate: string;
  endDate: string;
}

const DeviceTable: React.FC<DeviceTableProps> = ({
  paginatedDevices,
  selectedDeviceIds,
  setSelectedDeviceIds,
  currentUser,
  setSelectedDevice,
  handleBulkDelete,
  handleBulkUpdate,
  toggleSort,
  sortConfig,
  totalPages,
  currentPage,
  setCurrentPage,
  allFilteredDevicesCount,
  startDate,
  endDate
}) => {
  const isAllSelected = paginatedDevices.length > 0 && paginatedDevices.every(d => selectedDeviceIds.includes(d.id));
  
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedDeviceIds(prev => prev.filter(id => !paginatedDevices.map(d => d.id).includes(id)));
    } else {
      const newIds = paginatedDevices.map(d => d.id).filter(id => !selectedDeviceIds.includes(id));
      setSelectedDeviceIds(prev => [...prev, ...newIds]);
    }
  };

  const toggleSelectDevice = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedDeviceIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl overflow-hidden shadow-sm flex flex-col min-h-0 relative">
        {selectedDeviceIds.length > 0 && currentUser?.role === UserRole.ADMIN && (
          <div className="absolute top-0 left-0 right-0 bg-primary text-white px-4 py-2 z-20 flex items-center justify-between animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-4">
              <span className="text-xs font-black uppercase tracking-widest">{selectedDeviceIds.length} seleccionados</span>
              <div className="h-4 w-px bg-white/20"></div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase opacity-70">Cambiar a:</span>
                <button 
                  onClick={() => handleBulkUpdate({ status: DeviceStatus.FUNCIONA })}
                  className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[10px] font-bold uppercase transition-colors"
                >
                  Funciona
                </button>
                <button 
                  onClick={() => handleBulkUpdate({ status: DeviceStatus.NO_FUNCIONA })}
                  className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[10px] font-bold uppercase transition-colors"
                >
                  No Funciona
                </button>
                <button 
                  onClick={() => handleBulkUpdate({ status: DeviceStatus.DADO_DE_BAJA })}
                  className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[10px] font-bold uppercase transition-colors"
                >
                  Dado de baja
                </button>
                <div className="h-4 w-px bg-white/20 mx-1"></div>
                <button 
                  onClick={() => handleBulkUpdate({ location: 'Deposito' })}
                  className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[10px] font-bold uppercase transition-colors"
                >
                  Depósito
                </button>
                <button 
                  onClick={() => handleBulkUpdate({ location: 'Home' })}
                  className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[10px] font-bold uppercase transition-colors"
                >
                  Home
                </button>
                <button 
                  onClick={() => handleBulkUpdate({ location: 'Remoto' })}
                  className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[10px] font-bold uppercase transition-colors"
                >
                  Remoto
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={(e) => { e.stopPropagation(); handleBulkDelete(); }}
                className="flex items-center gap-1 px-3 py-1 rounded bg-rose-500 hover:bg-rose-600 text-[10px] font-bold uppercase transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
                Eliminar
              </button>
              <div className="h-4 w-px bg-white/20 mx-1"></div>
              <button 
                onClick={() => setSelectedDeviceIds([])}
                className="text-white/70 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          </div>
        )}
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse table-auto min-w-[1200px] text-sm">
            <thead className="sticky top-0 bg-slate-50/95 dark:bg-background-dark/95 backdrop-blur-sm z-10 border-b border-slate-200 dark:border-border-dark">
              <tr>
                {currentUser?.role === UserRole.ADMIN && (
                  <th className="px-4 py-3 w-10">
                    <input 
                      type="checkbox" 
                      checked={isAllSelected} 
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-primary focus:ring-primary"
                    />
                  </th>
                )}
                <th className="px-4 py-3 text-[10px] font-bold tracking-wider text-slate-500"><SortButton column="serialNumber" label="S/N" sortConfig={sortConfig} toggleSort={toggleSort} /></th>
                <th className="px-4 py-3 text-[10px] font-bold tracking-wider text-slate-500"><SortButton column="shelfTag" label="Ficha" sortConfig={sortConfig} toggleSort={toggleSort} /></th>
                <th className="px-4 py-3 text-[10px] font-bold tracking-wider text-slate-500"><SortButton column="type" label="Tipo" sortConfig={sortConfig} toggleSort={toggleSort} /></th>
                <th className="px-4 py-3 text-[10px] font-bold tracking-wider text-slate-500">Adjunto</th>
                <th className="px-4 py-3 text-[10px] font-bold tracking-wider text-slate-500"><SortButton column="brand" label="Marca/Mod" sortConfig={sortConfig} toggleSort={toggleSort} /></th>
                <th className="px-4 py-3 text-[10px] font-bold tracking-wider text-slate-500"><SortButton column="area" label="Área" sortConfig={sortConfig} toggleSort={toggleSort} /></th>
                <th className="px-4 py-3 text-[10px] font-bold tracking-wider text-slate-500"><SortButton column="location" label="Ubicación" sortConfig={sortConfig} toggleSort={toggleSort} /></th>
                <th className="px-4 py-3 text-[10px] font-bold tracking-wider text-slate-500"><SortButton column="status" label="Estado" sortConfig={sortConfig} toggleSort={toggleSort} /></th>
                <th className="px-4 py-3 text-[10px] font-bold tracking-wider text-slate-500"><SortButton column="assignedUser" label="Usuario / P-P" sortConfig={sortConfig} toggleSort={toggleSort} /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-border-dark">
              {paginatedDevices.length > 0 ? paginatedDevices.map((device) => (
                <tr 
                  key={device.id} 
                  onClick={() => setSelectedDevice(device)} 
                  className={`hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer ${selectedDeviceIds.includes(device.id) ? 'bg-primary/5 dark:bg-primary/10' : ''}`}
                >
                  {currentUser?.role === UserRole.ADMIN && (
                    <td className="px-4 py-3" onClick={(e) => toggleSelectDevice(e, device.id)}>
                      <input 
                        type="checkbox" 
                        checked={selectedDeviceIds.includes(device.id)} 
                        readOnly
                        className="rounded border-slate-300 text-primary focus:ring-primary pointer-events-none"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 font-mono text-[11px]">{device.serialNumber}</td>
                  <td className="px-4 py-3 font-mono text-[11px]">{device.shelfTag}</td>
                  <td className="px-4 py-3 font-bold text-primary text-[10px] uppercase">{device.type}</td>
                  <td className="px-4 py-3">
                    {device.attachments?.length > 0 ? <span className="material-symbols-outlined text-emerald-500 text-lg">attach_file</span> : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-[13px]">{device.model}</div>
                    <div className="text-[11px] text-slate-500 uppercase">{device.brand}</div>
                  </td>
                  <td className="px-4 py-3 text-[11px]">{device.area}</td>
                  <td className="px-4 py-3 text-[10px] font-bold uppercase">{device.location}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${getStatusStyle(device.status)}`}>{device.status}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      {device.assignedUser ? (
                        <span className="text-[13px] font-medium">{device.assignedUser}</span>
                      ) : (
                        <span className="text-amber-500 font-bold text-[13px]">Sin asignar</span>
                      )}
                      <span className="text-[11px] text-slate-500 font-bold">
                        {device.piso || '?'}-{device.puesto || '?'}
                      </span>
                    </div>
                  </td>
                </tr>
              )) : <tr><td colSpan={currentUser?.role === UserRole.ADMIN ? 10 : 9} className="px-4 py-10 text-center text-slate-400 italic text-xs">No hay datos que coincidan con los filtros aplicados ({startDate || '...'} / {endDate || '...'})</td></tr>}
            </tbody>
          </table>
        </div>
      {totalPages > 1 && (
        <div className="px-4 py-3 flex items-center justify-between border-t border-slate-200 dark:border-border-dark bg-slate-50/50 dark:bg-background-dark/50">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
              disabled={currentPage === 1} 
              className="p-1.5 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-50 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                if (totalPages > 7) {
                  if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`min-w-[28px] h-7 rounded-lg text-[10px] font-black transition-all ${currentPage === page ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-slate-500 hover:bg-slate-200/50 dark:hover:bg-white/5'}`}
                      >
                        {page}
                      </button>
                    );
                  }
                  if (page === currentPage - 2 || page === currentPage + 2) {
                    return <span key={page} className="text-slate-400 text-[10px]">...</span>;
                  }
                  return null;
                }
                
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`min-w-[28px] h-7 rounded-lg text-[10px] font-black transition-all ${currentPage === page ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-slate-500 hover:bg-slate-200/50 dark:hover:bg-white/5'}`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>

            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
              disabled={currentPage === totalPages} 
              className="p-1.5 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-50 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Mostrando {paginatedDevices.length} de {allFilteredDevicesCount} activos
          </span>
        </div>
      )}
    </div>
  );
};

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<any, any> {
  constructor(props: any) {
    super(props);
    (this as any).state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    const state = (this as any).state;
    const props = (this as any).props;
    if (state.hasError) {
      let errorMessage = "Algo salió mal.";
      try {
        const parsedError = JSON.parse(state.error.message);
        if (parsedError.error) {
          errorMessage = `Error de Firestore: ${parsedError.error} (Operación: ${parsedError.operationType})`;
        }
      } catch (e) {
        errorMessage = state.error.message || "Error desconocido.";
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-background-dark p-4">
          <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
            <span className="material-symbols-outlined text-rose-500 text-5xl mb-4">error</span>
            <h2 className="text-xl font-black mb-2">¡Ups! Algo salió mal</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-primary text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:bg-primary/90 transition-all"
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }

    return props.children;
  }
}

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardSubTab, setDashboardSubTab] = useState<'all' | 'equipos' | 'otros'>('all');
  const [devices, setDevices] = useState<Device[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [filterValue, setFilterValue] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
  const [reportTypeFilter, setReportTypeFilter] = useState<string[]>([]);
  const [reportStatusFilter, setReportStatusFilter] = useState<string>('All');
  const [isReportTypeOpen, setIsReportTypeOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [isSmartScannerOpen, setIsSmartScannerOpen] = useState(false);
  const [scannedShelfTag, setScannedShelfTag] = useState('');
  const [prefilledData, setPrefilledData] = useState<Partial<Device> | undefined>(undefined);
  
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'single' | 'bulk';
    deviceId?: string;
    count?: number;
  }>({ isOpen: false, type: 'single' });

  const [userConfirmModal, setUserConfirmModal] = useState<{
    isOpen: boolean;
    userId?: string;
  }>({ isOpen: false });

  const [roleConfirmModal, setRoleConfirmModal] = useState<{
    isOpen: boolean;
    userId?: string;
    newRole?: UserRole;
  }>({ isOpen: false });

  const dateFilterRef = useRef<HTMLDivElement>(null);
  const reportTypeRef = useRef<HTMLDivElement>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dateFilterRef.current && !dateFilterRef.current.contains(event.target as Node)) {
        setIsDateFilterOpen(false);
      }
      if (reportTypeRef.current && !reportTypeRef.current.contains(event.target as Node)) {
        setIsReportTypeOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setIsDarkMode(isDark);
  }, []);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterValue, activeTab, dashboardSubTab, startDate, endDate]);

  const subTabFilteredDevices = useMemo(() => {
    let baseResult = devices;
    if (activeTab === 'dashboard') {
      if (dashboardSubTab === 'equipos') {
        baseResult = devices.filter(d => [DeviceType.NOTEBOOK, DeviceType.CPU, DeviceType.MONITOR].includes(d.type));
      } else if (dashboardSubTab === 'otros') {
        baseResult = devices.filter(d => ![DeviceType.NOTEBOOK, DeviceType.CPU, DeviceType.MONITOR].includes(d.type));
      }
    }
    return baseResult;
  }, [devices, activeTab, dashboardSubTab]);

  const allFilteredDevices = useMemo(() => {
    let baseResult = subTabFilteredDevices;
    
    // Filtro por pestaña principal (Asignaciones) - Solo si NO hay búsqueda activa
    if (activeTab === 'assignments' && (!searchQuery || searchQuery.trim() === '')) {
      baseResult = devices.filter(d => d.assignedUser && d.assignedUser.trim() !== '');
    }

    let result = baseResult.filter(d => {
      const q = searchQuery.toLowerCase().trim().replace(/[-\s]/g, '');

      const normalize = (val: string) => (val || '').toLowerCase().replace(/[-\s]/g, '');

      const matchesSearch = 
        normalize(d.serialNumber).includes(q) ||
        normalize(d.shelfTag).includes(q) ||
        normalize(d.brand).includes(q) ||
        normalize(d.model).includes(q) ||
        normalize(d.area).includes(q) ||
        normalize(d.sector).includes(q) ||
        normalize(d.type).includes(q) ||
        (d.assignedUser && normalize(d.assignedUser).includes(q)) ||
        (d.description && normalize(d.description).includes(q)) ||
        (d.comments && normalize(d.comments).includes(q));
      
      const isStatusMatch = Object.values(DeviceStatus).includes(filterValue as DeviceStatus);
      const isLocationMatch = ['Deposito', 'Home', 'Oficina', 'Remoto'].includes(filterValue);
      
      let matchesFilter = true;
      if (filterValue !== 'All') {
        if (isStatusMatch) {
          matchesFilter = d.status === filterValue;
        } else if (isLocationMatch) {
          matchesFilter = d.location === filterValue;
        }
      }

      // Filtro de fecha (Comparación robusta de strings YYYY-MM-DD)
      let matchesDate = true;
      if (startDate && startDate !== '') {
        matchesDate = matchesDate && d.createdAt >= startDate;
      }
      if (endDate && endDate !== '') {
        matchesDate = matchesDate && d.createdAt <= endDate;
      }

      return matchesSearch && matchesFilter && matchesDate;
    });

    if (sortConfig) {
      result = [...result].sort((a, b) => {
        const aVal = (a[sortConfig.key] || '').toString().toLowerCase();
        const bVal = (b[sortConfig.key] || '').toString().toLowerCase();
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [devices, searchQuery, filterValue, sortConfig, activeTab, dashboardSubTab, startDate, endDate]);

  const stats: InventoryStats = useMemo(() => {
    const targetDevices = allFilteredDevices;
    const assignedCount = targetDevices.filter(d => d.assignedUser).length;
    const functioningCount = targetDevices.filter(d => d.status === DeviceStatus.FUNCIONA).length;
    const nonFunctioningCount = targetDevices.filter(d => d.status === DeviceStatus.NO_FUNCIONA).length;
    const decommissionedCount = targetDevices.filter(d => d.status === DeviceStatus.DADO_DE_BAJA).length;
    const availableCount = targetDevices.filter(d => d.location === 'Deposito' && d.status === DeviceStatus.FUNCIONA).length;
    
    return {
      totalAssets: targetDevices.length,
      assignedAssets: assignedCount,
      unassignedAssets: targetDevices.length - assignedCount,
      availableAssets: availableCount,
      functioningAssets: functioningCount,
      nonFunctioningAssets: nonFunctioningCount,
      decommissionedAssets: decommissionedCount,
    };
  }, [allFilteredDevices]);

  const paginatedDevices = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return allFilteredDevices.slice(start, start + itemsPerPage);
  }, [allFilteredDevices, currentPage]);

  const totalPages = Math.ceil(allFilteredDevices.length / itemsPerPage);

  useEffect(() => {
    const unsubscribeDevices = onSnapshot(collection(db, 'devices'), (snapshot) => {
      const devicesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Device));
      setDevices(devicesData);
      setIsLoading(false);

      // Bootstrap initial devices if collection is empty
      if (snapshot.empty && INITIAL_DEVICES.length > 0) {
        const now = new Date().toISOString().split('T')[0];
        INITIAL_DEVICES.forEach(async (rd) => {
          try {
            const deviceRef = doc(collection(db, 'devices'));
            const deviceId = deviceRef.id;
            
            const puestoRaw = rd.puesto || '';
            let piso = '';
            let puesto = puestoRaw;
            if (puestoRaw.includes('.') && !puestoRaw.startsWith('.')) {
              const parts = puestoRaw.split('.');
              piso = parts[0];
              puesto = parts.slice(1).join('.');
            }

            const newDevice: Device = {
              id: deviceId,
              serialNumber: rd.sn || '—',
              shelfTag: rd.tag || '',
              type: rd.type || DeviceType.OTRO,
              brand: rd.brand || '',
              model: rd.model || '',
              location: rd.loc || 'Oficina',
              status: rd.status || DeviceStatus.FUNCIONA,
              comments: rd.obs || '',
              assignedUser: rd.user || '',
              area: rd.area || '',
              sector: rd.sector || '',
              piso: piso,
              puesto: puesto,
              createdAt: now,
              lastUpdated: now,
              attachments: [],
              logs: [{ date: now, action: 'Alta (Carga Inicial)', details: 'Carga automática de equipos solicitados', performedBy: 'Sistema' }]
            };
            await setDoc(deviceRef, sanitizeForFirestore(newDevice));
          } catch (e) {
            console.error("Error bootstrapping device:", e);
          }
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'devices');
    });

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setUsers(usersData);
      
      // Bootstrap initial users if collection is empty
      if (snapshot.empty) {
        const initialUsers: User[] = [
          { id: '1', username: 'administrador', password: 'Mjggc3160', role: UserRole.ADMIN, fullName: 'Administrador' },
          { id: '2', username: '20333178762', password: 'Mjggc3160', role: UserRole.ADMIN, fullName: 'Julian' },
          { id: '3', username: '20301835281', password: 'Mjggc3160', role: UserRole.ADMIN, fullName: 'Gaston' },
          { id: '4', username: 'usuario', password: 'Qwerty123', role: UserRole.USER, fullName: 'Usuario' },
        ];
        initialUsers.forEach(async (user) => {
          try {
            await setDoc(doc(db, 'users', user.id), user);
          } catch (e) {
            console.error("Error bootstrapping user:", e);
          }
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      unsubscribeDevices();
      unsubscribeUsers();
    };
  }, []);

  // One-time cleanup of duplicates in Firestore
  useEffect(() => {
    if (devices.length > 0 && currentUser?.role === UserRole.ADMIN) {
      const seen = new Map<string, string>(); // key: sn|type|tag, value: id
      const toDelete: string[] = [];

      devices.forEach(d => {
        const sn = (d.serialNumber || '').trim();
        const tag = (d.shelfTag || '').trim();
        const type = d.type;
        
        // We allow multiple items with "—" serial number if they have different tags
        if (sn === '—' && !tag) return;
        
        const key = `${sn.toLowerCase()}|${type}|${tag.toLowerCase()}`;
        
        if (seen.has(key)) {
          toDelete.push(d.id);
        } else {
          seen.set(key, d.id);
        }
      });

      if (toDelete.length > 0) {
        const batch = writeBatch(db);
        toDelete.forEach(id => {
          batch.delete(doc(db, 'devices', id));
        });
        batch.commit().then(() => {
          console.log(`Eliminados ${toDelete.length} duplicados de Firestore.`);
        }).catch(err => {
          console.error("Error al eliminar duplicados:", err);
        });
      }
    }
  }, [devices, currentUser]);

  const handleUpdateUserRole = (userId: string, newRole: UserRole) => {
    setRoleConfirmModal({ isOpen: true, userId, newRole });
  };

  const confirmUpdateUserRole = async () => {
    if (!roleConfirmModal.userId || !roleConfirmModal.newRole) return;
    try {
      await updateDoc(doc(db, 'users', roleConfirmModal.userId), { role: roleConfirmModal.newRole });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${roleConfirmModal.userId}`);
    }
  };

  const handleDeleteUser = (userId: string) => {
    setUserConfirmModal({ isOpen: true, userId });
  };

  const confirmDeleteUser = async () => {
    if (!userConfirmModal.userId) return;
    try {
      await deleteDoc(doc(db, 'users', userConfirmModal.userId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userConfirmModal.userId}`);
    }
  };

  const handleRegisterUser = async (newUserData: Omit<User, 'id'>) => {
    try {
      const newUserId = Math.random().toString(36).substring(2, 11);
      const newUser: User = {
        ...newUserData,
        id: newUserId,
      };
      await setDoc(doc(db, 'users', newUserId), sanitizeForFirestore(newUser));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
    }
  };

  const handleAddDevice = async (newDeviceData: Omit<Device, 'id' | 'lastUpdated' | 'createdAt' | 'logs'>) => {
    // Validación de duplicados por S/N
    const duplicate = devices.find(d => 
      d.serialNumber.toLowerCase().replace(/[-\s]/g, '') === 
      newDeviceData.serialNumber.toLowerCase().replace(/[-\s]/g, '')
    );

    if (duplicate) {
      alert(`Error: Ya existe un equipo con el número de serie ${newDeviceData.serialNumber} (${duplicate.brand} ${duplicate.model}).`);
      return;
    }

    const now = new Date().toISOString().split('T')[0];
    const id = Math.random().toString(36).substr(2, 9);
    const newDevice: Device = {
      ...newDeviceData,
      id,
      createdAt: now,
      lastUpdated: now,
      logs: [{ 
        date: now, 
        action: 'Alta', 
        details: 'Ingreso manual al sistema.',
        performedBy: currentUser?.fullName || 'Sistema'
      }]
    };

    try {
      await setDoc(doc(db, 'devices', id), sanitizeForFirestore(newDevice));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `devices/${id}`);
    }
  };

  const handleDeleteDevice = (deviceId: string) => {
    setConfirmModal({
      isOpen: true,
      type: 'single',
      deviceId
    });
  };

  const confirmDeleteDevice = async () => {
    if (confirmModal.deviceId) {
      const deviceId = confirmModal.deviceId;
      try {
        await deleteDoc(doc(db, 'devices', deviceId));
        setSelectedDevice(null);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `devices/${deviceId}`);
      }
    }
  };

  const handleBulkDelete = () => {
    if (selectedDeviceIds.length === 0) return;
    setConfirmModal({
      isOpen: true,
      type: 'bulk',
      count: selectedDeviceIds.length
    });
  };

  const confirmBulkDelete = async () => {
    const idsToDelete = [...selectedDeviceIds];
    const batch = writeBatch(db);
    
    idsToDelete.forEach(id => {
      batch.delete(doc(db, 'devices', id));
    });

    try {
      await batch.commit();
      setSelectedDeviceIds([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'bulk-delete');
    }
  };

  const handleUpdateDevice = async (deviceId: string, updates: Partial<Device>) => {
    const now = new Date().toISOString().split('T')[0];
    const d = devices.find(dev => dev.id === deviceId);
    if (!d) return;

    const newLogs: DeviceLog[] = [...d.logs];
    const performer = currentUser?.fullName || 'Sistema';
    
    if (updates.status && updates.status !== d.status) newLogs.push({ date: now, action: 'Cambio Estado', details: `De ${d.status} a ${updates.status}`, performedBy: performer });
    if (updates.assignedUser !== undefined && updates.assignedUser !== d.assignedUser) newLogs.push({ date: now, action: 'Reasignación', details: `De ${d.assignedUser || 'Sin asignar'} a ${updates.assignedUser || 'Sin asignar'}`, performedBy: performer });
    if (updates.location && updates.location !== d.location) newLogs.push({ date: now, action: 'Traslado', details: `De ${d.location} a ${updates.location}`, performedBy: performer });
    if (updates.area && updates.area !== d.area) newLogs.push({ date: now, action: 'Cambio Área', details: `De ${d.area} a ${updates.area}`, performedBy: performer });
    if (updates.warrantyUntil !== undefined && updates.warrantyUntil !== d.warrantyUntil) newLogs.push({ date: now, action: 'Cambio Garantía', details: `De ${d.warrantyUntil || 'Sin fecha'} a ${updates.warrantyUntil || 'Sin fecha'}`, performedBy: performer });

    const updatedDevice = { ...d, ...updates, lastUpdated: now, logs: newLogs };
    
    try {
      await updateDoc(doc(db, 'devices', deviceId), sanitizeForFirestore({
        ...updates,
        lastUpdated: now,
        logs: newLogs
      }));
      if (selectedDevice?.id === deviceId) setSelectedDevice(updatedDevice);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `devices/${deviceId}`);
    }
  };

  const handleBulkUpdate = async (updates: Partial<Device>) => {
    if (selectedDeviceIds.length === 0) return;
    
    const idsToUpdate = [...selectedDeviceIds];
    const now = new Date().toISOString().split('T')[0];
    const performer = currentUser?.fullName || 'Sistema';
    const batch = writeBatch(db);

    idsToUpdate.forEach(id => {
      const d = devices.find(dev => dev.id === id);
      if (d) {
        const newLogs: DeviceLog[] = [...d.logs];
        if (updates.status && updates.status !== d.status) newLogs.push({ date: now, action: 'Cambio Estado (Masivo)', details: `De ${d.status} a ${updates.status}`, performedBy: performer });
        if (updates.location && updates.location !== d.location) newLogs.push({ date: now, action: 'Traslado (Masivo)', details: `De ${d.location} a ${updates.location}`, performedBy: performer });
        
        batch.update(doc(db, 'devices', id), sanitizeForFirestore({
          ...updates,
          lastUpdated: now,
          logs: newLogs
        }));
      }
    });

    try {
      await batch.commit();
      setSelectedDeviceIds([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'bulk-update');
    }
  };

  const handleScan = (tag: string) => {
    setIsQRScannerOpen(false);
    const foundDevice = devices.find(d => d.shelfTag === tag);
    if (foundDevice) {
      setSelectedDevice(foundDevice);
    } else {
      setScannedShelfTag(tag);
      setPrefilledData(undefined);
      setIsAddModalOpen(true);
    }
  };

  const handleSmartScanResult = (data: any) => {
    setIsSmartScannerOpen(false);
    
    // Buscar si el dispositivo ya existe por número de serie (normalizado)
    const serial = (data.serie || data.serialNumber || '').toLowerCase().replace(/[-\s]/g, '');
    const foundDevice = devices.find(d => d.serialNumber.toLowerCase().replace(/[-\s]/g, '') === serial);
    
    if (foundDevice) {
      alert(`Equipo ya registrado: Se encontró una coincidencia para el S/N ${data.serie}. Mostrando detalles.`);
      setSelectedDevice(foundDevice);
    } else {
      // Si no existe, abrir modal de alta con datos precargados
      setPrefilledData({
        serialNumber: data.serie || '',
        shelfTag: data.pn || '',
        brand: data.marca || '',
        model: data.modelo || '',
        description: `Procesador: ${data.procesador || 'N/A'}\nRAM: ${data.ram || 'N/A'}\nAlmacenamiento: ${data.almacenamiento || 'N/A'}`,
        type: DeviceType.NOTEBOOK // Por defecto o inferir del modelo si es posible
      });
      setIsAddModalOpen(true);
    }
  };

  const toggleSort = (key: keyof Device | 'assignedUser') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

interface DashboardViewProps {
  stats: InventoryStats;
  devices: Device[];
  dashboardSubTab: 'all' | 'equipos' | 'otros';
  setDashboardSubTab: React.Dispatch<React.SetStateAction<'all' | 'equipos' | 'otros'>>;
  dateFilterRef: React.RefObject<HTMLDivElement>;
  isDateFilterOpen: boolean;
  setIsDateFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  startDate: string;
  setStartDate: React.Dispatch<React.SetStateAction<string>>;
  endDate: string;
  setEndDate: React.Dispatch<React.SetStateAction<string>>;
  filterValue: string;
  setFilterValue: React.Dispatch<React.SetStateAction<string>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  allFilteredDevicesCount: number;
  paginatedDevices: Device[];
  selectedDeviceIds: string[];
  setSelectedDeviceIds: React.Dispatch<React.SetStateAction<string[]>>;
  currentUser: User | null;
  setSelectedDevice: (device: Device | null) => void;
  handleBulkDelete: () => void;
  handleBulkUpdate: (updates: Partial<Device>) => void;
  toggleSort: (key: keyof Device | 'assignedUser') => void;
  sortConfig: SortConfig;
  totalPages: number;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
}

const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  devices,
  dashboardSubTab,
  setDashboardSubTab,
  dateFilterRef,
  isDateFilterOpen,
  setIsDateFilterOpen,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  filterValue,
  setFilterValue,
  searchQuery,
  setSearchQuery,
  allFilteredDevicesCount,
  paginatedDevices,
  selectedDeviceIds,
  setSelectedDeviceIds,
  currentUser,
  setSelectedDevice,
  handleBulkDelete,
  handleBulkUpdate,
  toggleSort,
  sortConfig,
  totalPages,
  currentPage,
  setCurrentPage
}) => {
  const getSubTabCount = (type: 'all' | 'equipos' | 'otros') => {
    return devices.filter(d => {
      // Category filter
      if (type === 'equipos') {
        if (![DeviceType.NOTEBOOK, DeviceType.CPU, DeviceType.MONITOR].includes(d.type)) return false;
      } else if (type === 'otros') {
        if ([DeviceType.NOTEBOOK, DeviceType.CPU, DeviceType.MONITOR].includes(d.type)) return false;
      }

      // Search filter
      const q = searchQuery.toLowerCase().trim().replace(/[-\s]/g, '');
      const normalize = (val: string) => (val || '').toLowerCase().replace(/[-\s]/g, '');
      const matchesSearch = !q || (
        normalize(d.serialNumber).includes(q) ||
        normalize(d.shelfTag).includes(q) ||
        normalize(d.brand).includes(q) ||
        normalize(d.model).includes(q) ||
        normalize(d.area).includes(q) ||
        normalize(d.sector).includes(q) ||
        normalize(d.type).includes(q) ||
        (d.assignedUser && normalize(d.assignedUser).includes(q))
      );

      // Status filter
      const isStatusMatch = Object.values(DeviceStatus).includes(filterValue as DeviceStatus);
      const isLocationMatch = ['Deposito', 'Home', 'Oficina', 'Remoto'].includes(filterValue);
      let matchesFilter = true;
      if (filterValue !== 'All') {
        if (isStatusMatch) matchesFilter = d.status === filterValue;
        else if (isLocationMatch) matchesFilter = d.location === filterValue;
      }

      // Date filter
      let matchesDate = true;
      if (startDate) matchesDate = matchesDate && d.createdAt >= startDate;
      if (endDate) matchesDate = matchesDate && d.createdAt <= endDate;

      return matchesSearch && matchesFilter && matchesDate;
    }).length;
  };

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-6">
        <div 
          onClick={() => setFilterValue('All')}
          className={`bg-white dark:bg-surface-dark border ${filterValue === 'All' ? 'border-primary ring-2 ring-primary/10' : 'border-slate-200 dark:border-border-dark'} p-4 lg:p-6 rounded-xl lg:rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center group cursor-pointer`}
        >
          <div className={`mb-2 lg:mb-4 p-2 lg:p-3 bg-primary/10 rounded-xl lg:rounded-2xl text-primary transition-transform group-hover:scale-110 duration-300`}>
            <span className="material-symbols-outlined text-xl lg:text-3xl block">inventory</span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-[8px] lg:text-[10px] font-black uppercase tracking-widest mb-1 truncate w-full px-1">Hardware Total</p>
          <h3 className="text-lg lg:text-3xl font-black tracking-tighter text-slate-900 dark:text-white">{stats.totalAssets}</h3>
        </div>

        <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark p-4 lg:p-6 rounded-xl lg:rounded-2xl shadow-sm flex flex-col items-center text-center">
          <div className={`mb-2 lg:mb-4 p-2 lg:p-3 bg-indigo-500/10 rounded-xl lg:rounded-2xl text-indigo-500`}>
            <span className="material-symbols-outlined text-xl lg:text-3xl block">person_pin</span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-[8px] lg:text-[10px] font-black uppercase tracking-widest mb-1 truncate w-full px-1">Asignados / No Asignados</p>
          <h3 className="text-lg lg:text-3xl font-black tracking-tighter text-slate-900 dark:text-white">{stats.assignedAssets} / {stats.unassignedAssets}</h3>
        </div>

        <div 
          onClick={() => setFilterValue(DeviceStatus.FUNCIONA)}
          className={`bg-white dark:bg-surface-dark border ${filterValue === DeviceStatus.FUNCIONA ? 'border-emerald-500 ring-2 ring-emerald-500/10' : 'border-slate-200 dark:border-border-dark'} p-4 lg:p-6 rounded-xl lg:rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center group cursor-pointer`}
        >
          <div className={`mb-2 lg:mb-4 p-2 lg:p-3 bg-emerald-500/10 rounded-xl lg:rounded-2xl text-emerald-500 transition-transform group-hover:scale-110 duration-300`}>
            <span className="material-symbols-outlined text-xl lg:text-3xl block">check_circle</span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-[8px] lg:text-[10px] font-black uppercase tracking-widest mb-1 truncate w-full px-1">Funciona</p>
          <h3 className="text-lg lg:text-3xl font-black tracking-tighter text-slate-900 dark:text-white">{stats.functioningAssets}</h3>
        </div>

        <div 
          onClick={() => setFilterValue(DeviceStatus.NO_FUNCIONA)}
          className={`bg-white dark:bg-surface-dark border ${filterValue === DeviceStatus.NO_FUNCIONA ? 'border-rose-500 ring-2 ring-rose-500/10' : 'border-slate-200 dark:border-border-dark'} p-4 lg:p-6 rounded-xl lg:rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center group cursor-pointer`}
        >
          <div className={`mb-2 lg:mb-4 p-2 lg:p-3 bg-rose-500/10 rounded-xl lg:rounded-2xl text-rose-500 transition-transform group-hover:scale-110 duration-300`}>
            <span className="material-symbols-outlined text-xl lg:text-3xl block">error</span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-[8px] lg:text-[10px] font-black uppercase tracking-widest mb-1 truncate w-full px-1">No Funciona</p>
          <h3 className="text-lg lg:text-3xl font-black tracking-tighter text-slate-900 dark:text-white">{stats.nonFunctioningAssets}</h3>
        </div>

        <div 
          onClick={() => setFilterValue(DeviceStatus.DADO_DE_BAJA)}
          className={`bg-white dark:bg-surface-dark border ${filterValue === DeviceStatus.DADO_DE_BAJA ? 'border-orange-500 ring-2 ring-orange-500/10' : 'border-slate-200 dark:border-border-dark'} p-4 lg:p-6 rounded-xl lg:rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center group cursor-pointer`}
        >
          <div className={`mb-2 lg:mb-4 p-2 lg:p-3 bg-orange-500/10 rounded-xl lg:rounded-2xl text-orange-500 transition-transform group-hover:scale-110 duration-300`}>
            <span className="material-symbols-outlined text-xl lg:text-3xl block">delete_forever</span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-[8px] lg:text-[10px] font-black uppercase tracking-widest mb-1 truncate w-full px-1">Dados de Baja</p>
          <h3 className="text-lg lg:text-3xl font-black tracking-tighter text-slate-900 dark:text-white">{stats.decommissionedAssets}</h3>
        </div>
      </div>
      
      <div className="flex flex-col gap-4">
        <div className="flex flex-col xl:flex-row items-center xl:items-center justify-between gap-4">
          <div className="flex bg-white dark:bg-surface-dark p-1 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm h-[46px] items-center">
            <button 
              onClick={() => setDashboardSubTab('all')}
              className={`px-4 h-full text-[10px] font-black uppercase tracking-widest rounded-lg transition-all min-w-[120px] flex items-center justify-center gap-2 ${dashboardSubTab === 'all' ? 'bg-primary text-white shadow-md' : 'text-slate-500 hover:text-primary'}`}
            >
              Ver Todo
              <span className={`px-1.5 py-0.5 rounded-md text-[8px] ${dashboardSubTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-background-dark text-slate-400'}`}>{getSubTabCount('all')}</span>
            </button>
            <button 
              onClick={() => setDashboardSubTab('equipos')}
              className={`px-4 h-full text-[10px] font-black uppercase tracking-widest rounded-lg transition-all min-w-[120px] flex items-center justify-center gap-2 ${dashboardSubTab === 'equipos' ? 'bg-primary text-white shadow-md' : 'text-slate-500 hover:text-primary'}`}
            >
              Equipos
              <span className={`px-1.5 py-0.5 rounded-md text-[8px] ${dashboardSubTab === 'equipos' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-background-dark text-slate-400'}`}>{getSubTabCount('equipos')}</span>
            </button>
            <button 
              onClick={() => setDashboardSubTab('otros')}
              className={`px-4 h-full text-[10px] font-black uppercase tracking-widest rounded-lg transition-all min-w-[120px] flex items-center justify-center gap-2 ${dashboardSubTab === 'otros' ? 'bg-primary text-white shadow-md' : 'text-slate-500 hover:text-primary'}`}
            >
              Otros
              <span className={`px-1.5 py-0.5 rounded-md text-[8px] ${dashboardSubTab === 'otros' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-background-dark text-slate-400'}`}>{getSubTabCount('otros')}</span>
            </button>
          </div>
        
        <div className="flex flex-wrap items-center justify-center xl:justify-start gap-3 w-full xl:w-auto">
           <div className="relative" ref={dateFilterRef}>
              <button 
                  onClick={() => setIsDateFilterOpen(!isDateFilterOpen)}
                  className={`flex items-center gap-3 bg-white dark:bg-surface-dark border ${isDateFilterOpen ? 'border-primary ring-2 ring-primary/10' : 'border-slate-200 dark:border-border-dark'} rounded-xl px-4 py-2.5 shadow-sm group hover:border-primary/50 transition-all w-[220px] h-[46px]`}
              >
                  <div className={`flex items-center justify-center ${isDateFilterOpen ? 'bg-primary text-white' : 'bg-primary/10 text-primary'} rounded-lg p-1.5 group-hover:bg-primary group-hover:text-white transition-colors`}>
                      <span className="material-symbols-outlined text-lg">calendar_month</span>
                  </div>
                  <div className="flex flex-col items-start flex-1 overflow-hidden">
                      <span className="text-[10px] font-black uppercase tracking-widest truncate w-full">Filtrar Fecha</span>
                      {(startDate || endDate) && (
                          <span className="text-[7px] font-bold text-primary truncate w-full">
                              {startDate || '...'} / {endDate || '...'}
                          </span>
                      )}
                  </div>
                  <span className="material-symbols-outlined text-slate-400 text-lg transition-transform duration-200" style={{ transform: isDateFilterOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
              </button>

              {isDateFilterOpen && (
                  <div className="absolute top-full right-0 mt-2 z-30 bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-2xl p-5 shadow-2xl min-w-[320px] animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center justify-between mb-4">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rango de Fecha</h4>
                          {(startDate || endDate) && (
                              <button 
                                  onClick={() => {setStartDate(''); setEndDate('');}} 
                                  className="text-rose-500 text-[9px] font-black uppercase hover:underline"
                              >
                                  Limpiar
                              </button>
                          )}
                      </div>
                      <div className="space-y-4">
                          <div className="flex flex-col gap-1.5">
                              <label className="text-[9px] font-black uppercase text-slate-500 tracking-tighter">Fecha Desde</label>
                              <input 
                                  type="date" 
                                  className="bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-primary/20 outline-none w-full cursor-pointer text-slate-700 dark:text-slate-200"
                                  value={startDate || ''}
                                  onChange={(e) => setStartDate(e.target.value)}
                              />
                          </div>
                          <div className="flex flex-col gap-1.5">
                              <label className="text-[9px] font-black uppercase text-slate-500 tracking-tighter">Fecha Hasta</label>
                              <input 
                                  type="date" 
                                  className="bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-primary/20 outline-none w-full cursor-pointer text-slate-700 dark:text-slate-200"
                                  value={endDate || ''}
                                  onChange={(e) => setEndDate(e.target.value)}
                              />
                          </div>
                      </div>
                      <button 
                          onClick={() => setIsDateFilterOpen(false)}
                          className="w-full mt-6 bg-primary text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                      >
                          Aplicar Filtro
                      </button>
                  </div>
              )}
           </div>

           <select 
              className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl px-4 py-2.5 text-[10px] font-black uppercase focus:ring-2 focus:ring-primary/20 outline-none shadow-sm cursor-pointer appearance-none w-[220px] h-[46px]"
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
            >
              <option value="All">Todos los Estados</option>
              {Object.values(DeviceStatus).map(s => <option key={s} value={s}>{s}</option>)}
              <option value="Deposito">En Depósito</option>
              <option value="Home">En Home</option>
              <option value="Oficina">En Oficina</option>
            </select>

            {(searchQuery || filterValue !== 'All' || startDate || endDate) && (
              <button 
                  onClick={() => {setFilterValue('All'); setSearchQuery(''); setStartDate(''); setEndDate('');}} 
                  className="text-rose-500 text-[10px] font-black uppercase hover:underline ml-auto xl:ml-0 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">filter_alt_off</span>
                Limpiar Todo
              </button>
            )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 gap-2 sm:gap-0 text-center sm:text-left">
        <div className="flex items-center gap-2">
          <span className="w-1 h-1 bg-primary rounded-full"></span>
          <span>{dashboardSubTab === 'all' ? 'Inventario Completo' : (dashboardSubTab === 'equipos' ? 'Puestos de Trabajo' : 'Otros Activos')}</span>
        </div>
        <span>{allFilteredDevicesCount} resultados encontrados</span>
      </div>
    </div>

    <DeviceTable 
      paginatedDevices={paginatedDevices}
      selectedDeviceIds={selectedDeviceIds}
      setSelectedDeviceIds={setSelectedDeviceIds}
      currentUser={currentUser}
      setSelectedDevice={setSelectedDevice}
      handleBulkDelete={handleBulkDelete}
      handleBulkUpdate={handleBulkUpdate}
      toggleSort={toggleSort}
      sortConfig={sortConfig}
      totalPages={totalPages}
      currentPage={currentPage}
      setCurrentPage={setCurrentPage}
      allFilteredDevicesCount={allFilteredDevicesCount}
      startDate={startDate}
      endDate={endDate}
    />
  </>
);
};

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-background-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cargando Sistema...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login 
      onLogin={(user) => { setIsAuthenticated(true); setCurrentUser(user); }} 
      users={users} 
    />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} onLogout={handleLogout} currentUser={currentUser} />
      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <header className="h-16 border-b border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark flex items-center justify-between px-4 lg:px-8 shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-slate-500 p-1">
              <span className="material-symbols-outlined text-2xl">menu</span>
            </button>
            <div>
              <h2 className="text-sm lg:text-lg font-bold leading-none capitalize">
                {activeTab === 'dashboard' ? 'Inventario Hardware' : (activeTab === 'assignments' ? 'Asignaciones' : (activeTab === 'reports' ? 'Reportes' : 'Usuarios'))}
              </h2>
              <p className="text-[10px] lg:hidden text-slate-400 font-bold uppercase tracking-tight">Mesa de Ayuda</p>
            </div>
          </div>
          <div className="flex items-center gap-2 lg:gap-4">
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-slate-100 dark:bg-background-dark text-slate-500 dark:text-slate-400 hover:text-primary transition-colors flex items-center justify-center shadow-sm border border-slate-200 dark:border-border-dark"
              title={isDarkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            >
              <span className="material-symbols-outlined text-[20px]">
                {isDarkMode ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
            {currentUser?.role === UserRole.ADMIN && (
              <>
                <button 
                  onClick={() => setIsQRScannerOpen(true)}
                  className="p-2 rounded-lg bg-slate-100 dark:bg-background-dark text-slate-500 dark:text-slate-400 hover:text-primary transition-colors flex items-center justify-center shadow-sm border border-slate-200 dark:border-border-dark"
                  title="Escanear QR"
                >
                  <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
                </button>
                <button 
                  onClick={() => setIsSmartScannerOpen(true)}
                  className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center justify-center shadow-sm border border-primary/20"
                  title="Escaneo Inteligente (IA)"
                >
                  <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                </button>
              </>
            )}
            {activeTab !== 'reports' && (
              <div className="hidden sm:block relative">
                <input
                    type="text"
                    placeholder="Buscar por S/N, Marca, Tipo..."
                    className="w-48 lg:w-80 bg-slate-100 dark:bg-background-dark border-none rounded-lg px-4 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none"
                    value={searchQuery || ''}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            )}
            {activeTab !== 'reports' && activeTab !== 'users' && currentUser?.role === UserRole.ADMIN && (
              <button onClick={() => setIsAddModalOpen(true)} className="bg-primary text-white p-2 lg:px-4 lg:py-2 rounded-lg text-[10px] lg:text-sm font-semibold flex items-center gap-1 lg:gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform active:scale-[0.98]">
                <span className="material-symbols-outlined text-lg">add</span> <span className="hidden sm:inline">Nuevo Ingreso</span>
              </button>
            )}
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-6 lg:space-y-8 custom-scrollbar">
          {activeTab === 'dashboard' && (
            <DashboardView 
              stats={stats}
              devices={devices}
              dashboardSubTab={dashboardSubTab}
              setDashboardSubTab={setDashboardSubTab}
              dateFilterRef={dateFilterRef}
              isDateFilterOpen={isDateFilterOpen}
              setIsDateFilterOpen={setIsDateFilterOpen}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
              filterValue={filterValue}
              setFilterValue={setFilterValue}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              allFilteredDevicesCount={allFilteredDevices.length}
              paginatedDevices={paginatedDevices}
              selectedDeviceIds={selectedDeviceIds}
              setSelectedDeviceIds={setSelectedDeviceIds}
              currentUser={currentUser}
              setSelectedDevice={setSelectedDevice}
              handleBulkDelete={handleBulkDelete}
              handleBulkUpdate={handleBulkUpdate}
              toggleSort={toggleSort}
              sortConfig={sortConfig}
              totalPages={totalPages}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
            />
          )}
          {activeTab === 'assignments' && (
            <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                <div className="bg-primary/5 border border-primary/10 p-3 lg:p-4 rounded-xl flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-xl">info</span>
                    <p className="text-[11px] lg:text-xs text-primary font-medium italic">Mostrando equipos asignados a usuarios finales.</p>
                </div>
                <DeviceTable 
                  paginatedDevices={paginatedDevices}
                  selectedDeviceIds={selectedDeviceIds}
                  setSelectedDeviceIds={setSelectedDeviceIds}
                  currentUser={currentUser}
                  setSelectedDevice={setSelectedDevice}
                  handleBulkDelete={handleBulkDelete}
                  handleBulkUpdate={handleBulkUpdate}
                  toggleSort={toggleSort}
                  sortConfig={sortConfig}
                  totalPages={totalPages}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  allFilteredDevicesCount={allFilteredDevices.length}
                  startDate={startDate}
                  endDate={endDate}
                />
            </div>
          )}
          {activeTab === 'reports' && (
            <ReportsView 
              devices={devices}
              reportTypeFilter={reportTypeFilter}
              setReportTypeFilter={setReportTypeFilter}
              reportStatusFilter={reportStatusFilter}
              setReportStatusFilter={setReportStatusFilter}
              isReportTypeOpen={isReportTypeOpen}
              setIsReportTypeOpen={setIsReportTypeOpen}
              reportTypeRef={reportTypeRef}
            />
          )}
          {activeTab === 'users' && currentUser?.username === 'administrador' && (
            <UsersView 
              users={users} 
              onUpdateRole={handleUpdateUserRole} 
              onDeleteUser={handleDeleteUser}
              currentUser={currentUser} 
              onAddUser={() => setIsAddUserModalOpen(true)} 
            />
          )}
        </div>
        <footer className="h-10 border-t border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark flex items-center justify-center px-4 shrink-0 z-10">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Soporte Mjggc 2026, todos los derechos reservados
          </p>
        </footer>
      </main>
      <AddDeviceModal 
        isOpen={isAddModalOpen} 
        onClose={() => { setIsAddModalOpen(false); setScannedShelfTag(''); setPrefilledData(undefined); }} 
        onAdd={handleAddDevice} 
        initialShelfTag={scannedShelfTag}
        prefilledData={prefilledData}
      />
      <DeviceDetailModal 
        device={selectedDevice} 
        onClose={() => setSelectedDevice(null)} 
        onUpdate={handleUpdateDevice} 
        onDelete={handleDeleteDevice}
        canEdit={currentUser?.role === UserRole.ADMIN}
      />
      <QRScannerModal 
        isOpen={isQRScannerOpen} 
        onClose={() => setIsQRScannerOpen(false)} 
        onScan={handleScan} 
      />
      <SmartScannerModal
        isOpen={isSmartScannerOpen}
        onClose={() => setIsSmartScannerOpen(false)}
        onResult={handleSmartScanResult}
        devices={devices}
      />
      <AddUserModal 
        isOpen={isAddUserModalOpen} 
        onClose={() => setIsAddUserModalOpen(false)} 
        onAdd={handleRegisterUser} 
        users={users}
      />
      <ConfirmationModal 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.type === 'single' ? confirmDeleteDevice : confirmBulkDelete}
        title={confirmModal.type === 'single' ? 'Eliminar Equipo' : 'Eliminar Equipos'}
        message={confirmModal.type === 'single' 
          ? '¿Estás seguro de que deseas eliminar este equipo del inventario? Esta acción no se puede deshacer.' 
          : `¿Estás seguro de que deseas eliminar los ${confirmModal.count} equipos seleccionados? Esta acción no se puede deshacer.`}
      />
      <ConfirmationModal 
        isOpen={userConfirmModal.isOpen}
        onClose={() => setUserConfirmModal({ isOpen: false })}
        onConfirm={confirmDeleteUser}
        title="Eliminar Usuario"
        message="¿Estás seguro de que deseas eliminar este usuario? Esta acción no se puede deshacer y el usuario perderá el acceso al sistema."
      />
      <ConfirmationModal 
        isOpen={roleConfirmModal.isOpen}
        onClose={() => setRoleConfirmModal({ isOpen: false })}
        onConfirm={confirmUpdateUserRole}
        title="Cambiar Rol de Usuario"
        message={`¿Estás seguro de que deseas cambiar el rol de este usuario a ${roleConfirmModal.newRole === UserRole.ADMIN ? 'Administrador' : 'Usuario'}?`}
        confirmText="Confirmar"
        confirmColor="bg-primary"
      />
    </div>
  );
};

interface ReportsViewProps {
  devices: Device[];
  reportTypeFilter: string[];
  setReportTypeFilter: React.Dispatch<React.SetStateAction<string[]>>;
  reportStatusFilter: string;
  setReportStatusFilter: React.Dispatch<React.SetStateAction<string>>;
  isReportTypeOpen: boolean;
  setIsReportTypeOpen: React.Dispatch<React.SetStateAction<boolean>>;
  reportTypeRef: React.RefObject<HTMLDivElement>;
}

const ReportsView: React.FC<ReportsViewProps> = ({
  devices,
  reportTypeFilter,
  setReportTypeFilter,
  reportStatusFilter,
  setReportStatusFilter,
  isReportTypeOpen,
  setIsReportTypeOpen,
  reportTypeRef
}) => {
  const filteredReportsDevices = useMemo(() => {
    return devices.filter(d => {
      let matchesType = reportTypeFilter.length === 0;
      if (!matchesType) {
        matchesType = reportTypeFilter.some(filter => {
          return d.type.toLowerCase() === filter.toLowerCase();
        });
      }
      const matchesStatus = reportStatusFilter === 'All' || d.status === reportStatusFilter;
      return matchesType && matchesStatus;
    });
  }, [devices, reportTypeFilter, reportStatusFilter]);

  const typeCounts = filteredReportsDevices.reduce((acc, d) => { acc[d.type] = (acc[d.type] || 0) + 1; return acc; }, {} as Record<string, number>);
  const statusCounts = filteredReportsDevices.reduce((acc, d) => { acc[d.status] = (acc[d.status] || 0) + 1; return acc; }, {} as Record<string, number>);
  const areaCounts = filteredReportsDevices.reduce((acc, d) => { acc[d.area] = (acc[d.area] || 0) + 1; return acc; }, {} as Record<string, number>);
  const sectorCounts = filteredReportsDevices.reduce((acc, d) => { acc[d.sector] = (acc[d.sector] || 0) + 1; return acc; }, {} as Record<string, number>);
  const locationCounts = filteredReportsDevices.reduce((acc, d) => { acc[d.location] = (acc[d.location] || 0) + 1; return acc; }, {} as Record<string, number>);
  
  const maxType = Math.max(...(Object.values(typeCounts) as number[]), 1);
  const colors = ['#137fec', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  const PieChart = ({ data, title, icon, iconColor }: { data: Record<string, number>, title: string, icon: string, iconColor: string }) => {
      const total = Object.values(data).reduce((a, b) => a + b, 0);
      let cumulativePercent = 0;
      const entries = Object.entries(data);

      return (
          <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark p-6 rounded-2xl shadow-sm flex flex-col">
              <h3 className="text-sm font-bold uppercase text-slate-500 mb-6 flex items-center gap-2">
                  <span className={`material-symbols-outlined ${iconColor}`}>{icon}</span> {title}
              </h3>
              <div className="flex flex-col sm:flex-row items-center gap-8 flex-1">
                  <div className="relative w-32 h-32 flex-shrink-0">
                      <svg viewBox="0 0 32 32" className="w-full h-full -rotate-90 rounded-full">
                          {entries.map(([key, value], i) => {
                              const percent = (value / total) * 100;
                              const currentOffset = -cumulativePercent;
                              cumulativePercent += percent;
                              return (
                                  <circle
                                      key={key}
                                      r="16"
                                      cx="16"
                                      cy="16"
                                      fill="transparent"
                                      stroke={colors[i % colors.length]}
                                      strokeWidth="32"
                                      strokeDasharray={`${percent + 0.2} 100`}
                                      strokeDashoffset={currentOffset}
                                      pathLength="100"
                                  />
                              );
                          })}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-lg font-black">{total}</span>
                          <span className="text-[8px] font-bold uppercase text-slate-400">Total</span>
                      </div>
                  </div>
                  <div className="flex-1 w-full space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-2">
                      {entries.map(([key, value], i) => (
                          <div key={key} className="flex items-center justify-between group">
                              <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[i % colors.length] }}></div>
                                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 truncate max-w-[140px]">{key}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black">{value}</span>
                                  <span className="text-[9px] text-slate-400">({((value / total) * 100).toFixed(0)}%)</span>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      );
  };

  const locationData = [
    { name: 'Deposito', value: locationCounts['Deposito'] || 0 },
    { name: 'Home', value: locationCounts['Home'] || 0 },
    { name: 'Oficina', value: locationCounts['Oficina'] || 0 },
  ];

  const CustomXAxisTick = ({ x, y, payload }: any) => {
    const dataItem = locationData.find(d => d.name === payload.value);
    return (
      <g transform={`translate(${x},${y})`}>
        <text 
          x={0} 
          y={0} 
          dy={16} 
          textAnchor="middle" 
          fill="#94a3b8" 
          fontSize={10} 
          fontWeight={900} 
          className="uppercase tracking-widest"
        >
          {payload.value}
        </text>
        <text 
          x={0} 
          y={0} 
          dy={32} 
          textAnchor="middle" 
          fill="#137fec" 
          fontSize={12} 
          fontWeight={900} 
        >
          {dataItem?.value || 0}
        </text>
      </g>
    );
  };

  return (
    <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-500 pb-8">
      <div className="flex flex-wrap items-center gap-4 bg-white dark:bg-surface-dark p-4 rounded-2xl border border-slate-200 dark:border-border-dark shadow-sm">
         <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">filter_list</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Filtros de Reporte:</span>
         </div>
         
         <div className="relative" ref={reportTypeRef}>
           <button 
              onClick={() => setIsReportTypeOpen(!isReportTypeOpen)}
              className="bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-4 py-2 text-[10px] font-black uppercase focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer flex items-center gap-2 min-w-[180px] justify-between"
           >
              <span className="truncate max-w-[140px]">
                {reportTypeFilter.length === 0 ? 'Todos los Tipos' : reportTypeFilter.join(', ')}
              </span>
              <span className="material-symbols-outlined text-slate-400 text-sm">{isReportTypeOpen ? 'expand_less' : 'expand_more'}</span>
           </button>

           {isReportTypeOpen && (
             <div className="absolute top-full left-0 mt-2 z-30 bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl p-2 shadow-xl min-w-[200px] animate-in fade-in slide-in-from-top-1 duration-200">
               {['Notebook', 'CPU', 'Monitor', 'Otro'].map(type => (
                 <label key={type} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg cursor-pointer transition-colors group">
                   <div className="relative flex items-center">
                      <input 
                        type="checkbox" 
                        className="peer appearance-none w-4 h-4 border-2 border-slate-300 dark:border-slate-600 rounded-md checked:bg-primary checked:border-primary transition-all cursor-pointer"
                        checked={reportTypeFilter.includes(type)}
                        onChange={() => {
                          setReportTypeFilter(prev => 
                            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
                          );
                        }}
                      />
                      <span className="material-symbols-outlined absolute text-white text-[12px] opacity-0 peer-checked:opacity-100 pointer-events-none left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-bold">check</span>
                   </div>
                   <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 group-hover:text-primary transition-colors">{type}</span>
                 </label>
               ))}
               <div className="border-t border-slate-100 dark:border-border-dark mt-2 pt-2 flex justify-end">
                  <button 
                    onClick={() => setIsReportTypeOpen(false)}
                    className="text-[9px] font-black uppercase text-primary hover:underline px-2"
                  >
                    Cerrar
                  </button>
               </div>
             </div>
           )}
         </div>

          <select 
            className="bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-4 py-2 text-[10px] font-black uppercase focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer appearance-none min-w-[160px]"
            value={reportStatusFilter}
            onChange={(e) => setReportStatusFilter(e.target.value)}
          >
            <option value="All">Estado General</option>
            {Object.values(DeviceStatus).map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {(reportTypeFilter.length > 0 || reportStatusFilter !== 'All') && (
            <button 
                onClick={() => {setReportTypeFilter([]); setReportStatusFilter('All');}} 
                className="text-rose-500 text-[10px] font-black uppercase hover:underline flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
              Limpiar
            </button>
          )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark p-5 lg:p-6 rounded-2xl shadow-sm">
              <h3 className="text-sm font-bold uppercase text-slate-500 mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">analytics</span> Distribución por Tipo
              </h3>
              <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                  {Object.entries(typeCounts).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([type, count]) => (
                      <div key={type} className="space-y-1">
                          <div className="flex justify-between text-[10px] font-bold"><span>{type}</span><span className="text-primary">{count} unid.</span></div>
                          <div className="h-2 bg-slate-100 dark:bg-background-dark rounded-full overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${((count as number) / maxType) * 100}%` }}></div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
          
          <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark p-5 lg:p-6 rounded-2xl shadow-sm flex flex-col items-center">
              <h3 className="text-sm font-bold uppercase text-slate-500 mb-6 w-full flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-500">health_and_safety</span> Estado General
              </h3>
              <div className="relative w-32 h-32 lg:w-40 lg:h-40 mb-6">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="16" fill="none" className="stroke-slate-100 dark:stroke-background-dark" strokeWidth="4"></circle>
                      <circle 
                        cx="18" 
                        cy="18" 
                        r="16" 
                        fill="none" 
                        className="stroke-emerald-500" 
                        strokeWidth="4" 
                        strokeDasharray={`${filteredReportsDevices.length > 0 ? ((statusCounts[DeviceStatus.FUNCIONA] as number || 0) / filteredReportsDevices.length) * 100 + 0.2 : 0} 100`}
                        pathLength="100"
                      ></circle>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xl lg:text-2xl font-black">{filteredReportsDevices.length > 0 ? (((statusCounts[DeviceStatus.FUNCIONA] as number || 0) / filteredReportsDevices.length) * 100).toFixed(0) : 0}%</span>
                      <span className="text-[9px] font-bold uppercase text-slate-400">OK</span>
                  </div>
              </div>
              <div className="grid grid-cols-2 gap-4 w-full text-center">
                  <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20"><p className="text-[9px] font-bold text-emerald-600 uppercase">Funciona</p><p className="text-lg font-black">{statusCounts[DeviceStatus.FUNCIONA] || 0}</p></div>
                  <div className="bg-rose-500/10 p-2 rounded-xl border border-rose-500/20"><p className="text-[9px] font-bold text-rose-600 uppercase">Falla</p><p className="text-lg font-black">{statusCounts[DeviceStatus.NO_FUNCIONA] || 0}</p></div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          <PieChart data={areaCounts} title="Distribución por Área" icon="groups" iconColor="text-indigo-500" />
          <PieChart data={sectorCounts} title="Distribución por Sector" icon="account_tree" iconColor="text-amber-500" />
      </div>

      <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark p-6 lg:p-8 rounded-2xl shadow-sm">
          <h3 className="text-sm font-bold uppercase text-slate-500 mb-8 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">location_on</span> Distribución por Ubicación
          </h3>
          
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height={320} minWidth={0}>
              <BarChart
                data={locationData}
                margin={{ top: 20, right: 30, left: 0, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2d333b" opacity={0.3} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  tick={<CustomXAxisTick />}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }}
                />
                <Bar 
                  dataKey="value" 
                  radius={[6, 6, 0, 0]} 
                  barSize={40}
                >
                  {locationData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill="#137fec" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
      </div>
    </div>
  );
};

const UsersView: React.FC<{ 
  users: User[], 
  onUpdateRole: (userId: string, newRole: UserRole) => void, 
  onDeleteUser: (userId: string) => void,
  currentUser: User | null, 
  onAddUser: () => void 
}> = ({ users, onUpdateRole, onDeleteUser, currentUser, onAddUser }) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-black tracking-tighter">Usuarios del Sistema</h2>
        <p className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Gestión de accesos y roles</p>
      </div>
      {currentUser?.username === 'administrador' && (
        <button 
          onClick={onAddUser}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] text-[10px] font-black uppercase tracking-widest"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          Nuevo Usuario
        </button>
      )}
    </div>

    <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-2xl overflow-hidden shadow-sm">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 dark:bg-background-dark/50 border-b border-slate-200 dark:border-border-dark">
            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Usuario</th>
            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Username</th>
            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Rol</th>
            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Estado</th>
            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-border-dark">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs">
                    {user.fullName.charAt(0)}
                  </div>
                  <span className="text-sm font-bold">{user.fullName}</span>
                </div>
              </td>
              <td className="px-6 py-4 text-sm text-slate-500">{user.username}</td>
              <td className="px-6 py-4">
                <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${user.role === UserRole.ADMIN ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20' : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'}`}>
                  {user.role}
                </span>
              </td>
              <td className="px-6 py-4">
                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase text-emerald-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Activo
                </span>
              </td>
              <td className="px-6 py-4 text-right">
                {currentUser?.username === 'administrador' && currentUser?.id !== user.id && (
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => onUpdateRole(user.id, user.role === UserRole.ADMIN ? UserRole.USER : UserRole.ADMIN)}
                      className="p-2 rounded-lg bg-slate-100 dark:bg-background-dark text-slate-500 hover:text-primary transition-colors border border-slate-200 dark:border-border-dark flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                      title={user.role === UserRole.ADMIN ? "Degradar a Usuario" : "Promover a Administrador"}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {user.role === UserRole.ADMIN ? 'person' : 'admin_panel_settings'}
                      </span>
                      {user.role === UserRole.ADMIN ? 'Hacer Usuario' : 'Hacer Admin'}
                    </button>
                    <button 
                      onClick={() => onDeleteUser(user.id)}
                      className="p-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all border border-rose-500/20 flex items-center justify-center"
                      title="Eliminar Usuario"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default () => (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
