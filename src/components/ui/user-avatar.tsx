import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import type { User } from "@/lib/types";

export function UserAvatar({
  user,
  size = 32,
  className,
}: {
  user: Pick<User, "name" | "avatarColor">;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid place-items-center rounded-full font-semibold text-white ring-1 ring-white/10",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: user.avatarColor,
        fontSize: size * 0.4,
      }}
      aria-hidden
    >
      {initials(user.name)}
    </div>
  );
}
