
export enum DeviceStatus {
  FUNCIONA = 'Funciona',
  NO_FUNCIONA = 'No funciona',
  DADO_DE_BAJA = 'Dado de baja'
}

export enum DeviceType {
  NOTEBOOK = 'Notebook',
  MONITOR = 'Monitor',
  CPU = 'CPU',
  IMPRESORA = 'Impresora',
  TABLET = 'Tablet',
  ALL_IN_ONE = 'All in One',
  CAMARA = 'Cámara',
  OTRO = 'Otro'
}

export interface Attachment {
  name: string;
  data: string; // Base64
  date: string;
}

export interface DeviceLog {
  date: string;
  action: string;
  details: string;
  performedBy?: string;
}

export interface Device {
  id: string;
  serialNumber: string;
  shelfTag: string;
  type: DeviceType;
  brand: string;
  model: string;
  location: string;
  status: DeviceStatus;
  comments?: string;
  description?: string;
  assignedUser?: string;
  assignedUserInitials?: string | null;
  createdAt: string;
  lastUpdated: string;
  // Campos de ubicación
  area: string;
  sector: string;
  piso: string;
  puesto: string;
  // Gestión de Adjuntos (Múltiples)
  attachments: Attachment[];
  // Historial de cambios
  logs: DeviceLog[];
  // Garantía
  warrantyUntil?: string;
}

export interface InventoryStats {
  totalAssets: number;
  assignedAssets: number;
  unassignedAssets: number;
  availableAssets: number;
  functioningAssets: number;
  nonFunctioningAssets: number;
  decommissionedAssets: number;
}

export enum UserRole {
  ADMIN = 'Administrador',
  USER = 'Usuario'
}

export interface User {
  id: string;
  username: string;
  password?: string;
  role: UserRole;
  fullName: string;
  lastLogin?: string;
}
