import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Outlet,
  Navigate,
  createRootRouteWithContext,
  useLocation,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeProvider, useTheme, THEME_INIT_SCRIPT } from "@/lib/theme-context";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingSprite } from "@/components/brand/LoadingSprite";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="text-6xl font-black tracking-tight text-brand">404</div>
        <h1 className="mt-3 text-lg font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          That page isn't part of the AS Construction system.
        </p>
        <a
          href="/"
          className="mt-5 inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground"
        >
          Go home
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-5 inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#fcfcfd", media: "(prefers-color-scheme: light)" },
      { name: "theme-color", content: "#1a1a1a", media: "(prefers-color-scheme: dark)" },
      { title: "AS Construction — Internal Management System" },
      {
        name: "description",
        content:
          "Internal project management system for Andrew Stuart Construction — projects, tasks, attendance, materials and reports.",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="bg-background text-foreground antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <AuthGate>
            <Outlet />
          </AuthGate>
          <ThemedToaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} position="top-right" />;
}

// Keeps the loading sprite on screen for at least this long so it's
// actually seen, even when auth resolves near-instantly from a warm session.
const MIN_SPLASH_MS = 1800;

function useMinDuration(active: boolean, ms: number) {
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  // Starts once on mount and runs to completion regardless of how `active`
  // changes — a splash's minimum-visible time is measured from app start,
  // not restarted every time the loading flag flips.
  useEffect(() => {
    const id = setTimeout(() => setMinTimeElapsed(true), ms);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return active || !minTimeElapsed;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const isPublicRoute = pathname === "/" || pathname === "/login" || pathname === "/acknowledge";
  const showSplash = useMinDuration(loading, MIN_SPLASH_MS);

  if (isPublicRoute) return children;

  if (showSplash) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <LoadingSprite />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;
  if (!user.acknowledged) return <Navigate to="/acknowledge" />;

  return <AppShell>{children}</AppShell>;
}
