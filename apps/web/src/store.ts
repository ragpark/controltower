'use client';
import { create } from 'zustand';

interface AppState {
  /** Order id currently open in the detail side panel (null = closed). */
  selectedOrderId: string | null;
  openOrder: (id: string) => void;
  closeOrder: () => void;

  /** Sidebar collapsed state (persist-worthy but session-scoped is fine). */
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedOrderId: null,
  openOrder: (id) => set({ selectedOrderId: id }),
  closeOrder: () => set({ selectedOrderId: null }),
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
