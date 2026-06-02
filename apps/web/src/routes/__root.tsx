import { useState, useEffect } from 'react';
import { createRootRoute, Link, Outlet, useLocation } from '@tanstack/react-router';
import { Toaster } from 'sonner';

export const Route = createRootRoute({
  component: RootLayout,
});

const NAV_LINKS = [
  { to: '/' as const, label: 'Dashboard' },
  { to: '/diseases' as const, label: 'Malattie' },
  { to: '/prs' as const, label: 'Predisposizione' },
  { to: '/pharmacogenomics' as const, label: 'Farmaci' },
  { to: '/carrier' as const, label: 'Carrier' },
  { to: '/ancestry' as const, label: 'Ancestry' },
  { to: '/traits' as const, label: 'Tratti & Fitness' },
  { to: '/salute' as const, label: 'Salute' },
  { to: '/cartella' as const, label: 'Cartella' },
  { to: '/variants' as const, label: 'Varianti' },
];

function RootLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-[hsl(var(--background))]/80 border-b border-[hsl(var(--border))]">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-shadow">
              D
            </div>
            <span className="font-bold text-base tracking-tight">rr-dna</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="px-3 py-1.5 rounded-md text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] transition-all [&.active]:text-[hsl(var(--foreground))] [&.active]:bg-[hsl(var(--secondary))]"
              >
                {label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/upload"
              className="hidden sm:block px-3 py-1.5 rounded-md text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              Upload
            </Link>
            <Link
              to="/settings"
              className="p-2 rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] transition-all"
              title="Impostazioni"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </Link>
            {/* Mobile hamburger */}
            <button
              className="lg:hidden p-2 rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] transition-all"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="18" x2="20" y2="18" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="lg:hidden border-t border-[hsl(var(--border))] px-4 py-3 space-y-1 bg-[hsl(var(--background))]">
            {NAV_LINKS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="block px-3 py-2.5 rounded-md text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] transition-all [&.active]:text-[hsl(var(--foreground))] [&.active]:bg-[hsl(var(--secondary))]"
              >
                {label}
              </Link>
            ))}
            <Link
              to="/upload"
              className="block px-3 py-2.5 rounded-md text-sm bg-emerald-600 hover:bg-emerald-500 text-white text-center transition-colors sm:hidden"
            >
              Upload
            </Link>
          </div>
        )}
      </nav>

      <main className="max-w-[1920px] mx-auto px-4 sm:px-8 lg:px-12 py-4 sm:py-6">
        <Outlet />
      </main>

      <Toaster theme="dark" position="bottom-right" richColors />
    </div>
  );
}
