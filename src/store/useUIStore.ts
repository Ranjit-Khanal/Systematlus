import { create } from "zustand";

export type Theme = "dark" | "light";

interface UIState {
  theme: Theme;
  searchOpen: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  openSearch: () => void;
  closeSearch: () => void;
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem("systematlas-theme");
  if (stored === "light" || stored === "dark") return stored;
  return "dark";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  window.localStorage.setItem("systematlas-theme", theme);
}

const initialTheme = getInitialTheme();
if (typeof document !== "undefined") applyTheme(initialTheme);

export const useUIStore = create<UIState>((set, get) => ({
  theme: initialTheme,
  searchOpen: false,
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    applyTheme(next);
    set({ theme: next });
  },
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
}));
