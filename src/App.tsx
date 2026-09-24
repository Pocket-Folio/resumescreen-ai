import { useCallback, useEffect, useState } from "react";
import { Route, Routes } from "react-router";
import { api, setUnauthorizedHandler } from "./api/client";
import { AppProvider } from "./context/AppContext";
import { ToastProvider } from "./context/ToastContext";
import { AppLayout } from "./components/layout/AppLayout";
import { Spinner } from "./components/ui/States";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { JobProfilesPage } from "./pages/JobProfilesPage";
import { JobProfileEditorPage } from "./pages/JobProfileEditorPage";
import { CandidatesPage } from "./pages/CandidatesPage";
import { UploadPage } from "./pages/UploadPage";
import { CandidateDetailPage } from "./pages/CandidateDetailPage";
import { ScreeningPage } from "./pages/ScreeningPage";
import { ComparePage } from "./pages/ComparePage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { NotFoundPage } from "./pages/NotFoundPage";

type AuthState = { loading: true } | { loading: false; authEnabled: boolean; authenticated: boolean; error?: string };

export function App() {
  const [auth, setAuth] = useState<AuthState>({ loading: true });

  const check = useCallback(async () => {
    try {
      const s = await api.auth.status();
      setAuth({ loading: false, ...s });
    } catch {
      setAuth({ loading: false, authEnabled: true, authenticated: false, error: "The server could not be reached." });
    }
  }, []);

  useEffect(() => {
    void check();
    setUnauthorizedHandler(() => setAuth((a) => (a.loading ? a : { ...a, authenticated: false })));
    return () => setUnauthorizedHandler(null);
  }, [check]);

  if (auth.loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Starting ResumeScreen AI…" />
      </div>
    );
  }

  if (!auth.authenticated) {
    return (
      <ToastProvider>
        <LoginPage serverError={auth.error} onSuccess={check} />
      </ToastProvider>
    );
  }

  const logout = async () => {
    await api.auth.logout().catch(() => undefined);
    await check();
  };

  return (
    <ToastProvider>
      <AppProvider>
        <Routes>
          <Route element={<AppLayout authEnabled={auth.authEnabled} onLogout={logout} />}>
            <Route index element={<DashboardPage />} />
            <Route path="job-profiles" element={<JobProfilesPage />} />
            <Route path="job-profiles/new" element={<JobProfileEditorPage />} />
            <Route path="job-profiles/:id" element={<JobProfileEditorPage />} />
            <Route path="candidates" element={<CandidatesPage />} />
            <Route path="candidates/upload" element={<UploadPage />} />
            <Route path="candidates/:id" element={<CandidateDetailPage />} />
            <Route path="screening" element={<ScreeningPage />} />
            <Route path="compare" element={<ComparePage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AppProvider>
    </ToastProvider>
  );
}
