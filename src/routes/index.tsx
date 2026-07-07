import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Logo size={36} />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;
  if (!user.acknowledged) return <Navigate to="/acknowledge" />;

  return <Navigate to="/dashboard" />;
}