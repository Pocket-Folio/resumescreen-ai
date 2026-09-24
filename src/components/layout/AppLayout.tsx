import { useEffect, useState, type FormEvent } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import {
  BarChart3,
  Briefcase,
  FileSearch,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Users,
  X,
  KeyRound,
} from "lucide-react";
import { cn } from "../../utils/cn";
import { useApp } from "../../context/AppContext";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/job-profiles", label: "Job Profiles", icon: Briefcase },
  { to: "/candidates", label: "Candidates", icon: Users },
  { to: "/screening", label: "Screening", icon: FileSearch },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <img src="/favicon.svg" alt="" className="size-8" />
      <div className="leading-tight">
        <div className="text-[15px] font-semibold text-ink">ResumeScreen AI</div>
        <div className="text-[11px] text-ink-3">HR screening assistant</div>
      </div>
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex h-full flex-col gap-6 px-3 py-5">
      <Logo />
      <ul className="space-y-0.5">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "bg-brand-soft text-brand-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                )
              }
            >
              <Icon className="size-4.5 shrink-0" aria-hidden />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="mt-auto rounded-xl border border-line bg-surface-2 p-3 text-xs text-ink-3">
        <div className="mb-1 flex items-center gap-1.5 font-medium text-ink-2">
          <ShieldCheck className="size-3.5" aria-hidden /> Human review required
        </div>
        AI assessments assist HR review. Final decisions are made by your HR team.
      </div>
    </nav>
  );
}

export function AppLayout({ authEnabled, onLogout }: { authEnabled: boolean; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { apiKey, settingsLoaded } = useApp();

  useEffect(() => setOpen(false), [location.pathname]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/candidates${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
  };

  return (
    <div className="flex min-h-full">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto border-r border-line bg-surface lg:block">
        <Sidebar />
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-line bg-surface shadow-xl">
            <button className="absolute top-4 right-3 rounded p-1 text-ink-3 hover:text-ink" onClick={() => setOpen(false)} aria-label="Close navigation">
              <X className="size-5" />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-15 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur sm:px-6">
          <button className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Menu className="size-5" />
          </button>
          <form onSubmit={submit} className="relative max-w-md flex-1" role="search">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search candidates by name, position or skill…"
              aria-label="Search candidates"
              className="input h-9 pl-9"
            />
          </form>
          <div className="ml-auto flex items-center gap-2">
            {settingsLoaded && !apiKey.configured && (
              <NavLink to="/settings" className="tone-yellow hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium sm:inline-flex">
                <KeyRound className="size-3.5" aria-hidden /> Claude API not configured
              </NavLink>
            )}
            <span className="tone-green hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium md:inline-flex" title="Candidate data is stored in this application's own database. It is sent to the Claude API only when you run a screening.">
              <ShieldCheck className="size-3.5" aria-hidden /> Data stored locally
            </span>
            {authEnabled && (
              <button onClick={onLogout} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">
                <LogOut className="size-4" aria-hidden /> <span className="hidden sm:inline">Sign out</span>
              </button>
            )}
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
