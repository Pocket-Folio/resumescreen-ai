/* eslint-disable react-refresh/only-export-components -- provider and its hook belong together */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type SettingsResponse } from "../api/client";
import type { AppSettings, Theme } from "../../shared/types";
import { DEFAULT_SETTINGS } from "../../shared/types";

interface AppContextValue {
  settings: AppSettings;
  apiKey: SettingsResponse["apiKey"];
  settingsLoaded: boolean;
  setSettingsResponse: (r: SettingsResponse) => void;
  reloadSettings: () => Promise<void>;
  /** Incremented after bulk data changes (demo load, delete all) so pages refetch. */
  dataVersion: number;
  bumpData: () => void;
}

const Ctx = createContext<AppContextValue | null>(null);

function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SettingsResponse>({
    settings: DEFAULT_SETTINGS,
    apiKey: { configured: false, source: "none", masked: null, workspaceId: null, workspaceSource: "none" },
  });
  const [loaded, setLoaded] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);

  const reloadSettings = useCallback(async () => {
    try {
      setState(await api.settings.get());
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void reloadSettings();
  }, [reloadSettings]);

  useEffect(() => {
    applyTheme(state.settings.theme);
    if (state.settings.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const fn = () => applyTheme("system");
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [state.settings.theme]);

  const value = useMemo<AppContextValue>(
    () => ({
      settings: state.settings,
      apiKey: state.apiKey,
      settingsLoaded: loaded,
      setSettingsResponse: setState,
      reloadSettings,
      dataVersion,
      bumpData: () => setDataVersion((v) => v + 1),
    }),
    [state, loaded, reloadSettings, dataVersion],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}
