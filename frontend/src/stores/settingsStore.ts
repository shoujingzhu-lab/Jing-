import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemeMode = 'dark' | 'light';
type Language = 'zh-CN' | 'en-US';

interface SettingsState {
  theme: ThemeMode;
  language: Language;
  sidebarCollapsed: boolean;
  confirmBeforeTrade: boolean;
  showBalance: boolean;

  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setLanguage: (language: Language) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setConfirmBeforeTrade: (confirm: boolean) => void;
  setShowBalance: (show: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      language: 'zh-CN',
      sidebarCollapsed: false,
      confirmBeforeTrade: true,
      showBalance: false,

      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      setLanguage: (language) => set({ language }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setConfirmBeforeTrade: (confirmBeforeTrade) => set({ confirmBeforeTrade }),
      setShowBalance: (showBalance) => set({ showBalance }),
    }),
    {
      name: 'quant-settings',
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        sidebarCollapsed: state.sidebarCollapsed,
        confirmBeforeTrade: state.confirmBeforeTrade,
      }),
    }
  )
);
