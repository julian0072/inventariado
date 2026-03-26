
import React from 'react';

import { User, UserRole } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onLogout: () => void;
  currentUser: User | null;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isOpen, setIsOpen, onLogout, currentUser }) => {
  const navItems = [
    { id: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
    { id: 'assignments', icon: 'assignment', label: 'Asignaciones' },
    { id: 'reports', icon: 'bar_chart', label: 'Reportes' },
    ...(currentUser?.username === 'administrador' ? [{ id: 'users', icon: 'group', label: 'Usuarios' }] : []),
  ];

  return (
    <>
      {/* Overlay para móviles */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 border-r border-slate-200 dark:border-border-dark 
        flex flex-col bg-white dark:bg-surface-dark transition-transform duration-300 lg:static lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined">devices</span>
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight">Mesa de Ayuda</h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Inventario</p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="lg:hidden text-slate-400 hover:text-primary"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 mt-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${
                activeTab === item.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-primary/5 hover:text-primary'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-border-dark">
          <div className="flex items-center justify-between p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors group">
            <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center border border-slate-200 dark:border-border-dark">
                    <span className="material-symbols-outlined text-slate-400 text-lg">person</span>
                </div>
                <div className="overflow-hidden">
                    <p className="text-xs font-semibold truncate">{currentUser?.fullName || 'Usuario'}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{currentUser?.role || 'System Admin'}</p>
                </div>
            </div>
            <button 
                onClick={onLogout}
                className="text-slate-400 hover:text-rose-500 transition-colors p-1 flex items-center justify-center rounded-md hover:bg-rose-500/10"
                title="Cerrar Sesión"
            >
                <span className="material-symbols-outlined text-lg">logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
