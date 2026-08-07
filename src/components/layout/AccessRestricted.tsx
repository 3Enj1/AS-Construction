import { ShieldAlert } from "lucide-react";

export function AccessRestricted({
  message = "This page is only available to admins.",
}: {
  message?: string;
}) {
  return (
    <div className="as-card flex flex-col items-center gap-3 p-10 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <ShieldAlert className="size-6" />
      </div>
      <div>
        <div className="font-semibold">Access restricted</div>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
