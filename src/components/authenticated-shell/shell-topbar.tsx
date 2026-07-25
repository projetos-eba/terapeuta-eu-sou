import { ShellNavigationToggle } from "./authenticated-shell";
import { ShellNotificationButton } from "./shell-notification-button";
import { ShellUserMenu } from "./shell-user-menu";

import type { ShellUser } from "./authenticated-shell";

export function ShellTopbar({
  notificationCount,
  onOpenNavigation,
  planLabel,
  user,
  variant,
}: {
  notificationCount: number;
  onOpenNavigation: () => void;
  planLabel?: string;
  user: ShellUser;
  variant: "admin" | "patient" | "therapist";
}) {
  return (
    <header
      className={`sticky top-0 z-10 flex items-center justify-between border-b border-[var(--tes-color-border)]/40 bg-white px-4 sm:px-6 lg:px-8 ${
        variant === "therapist"
          ? "h-20 lg:h-24"
          : "h-[var(--tes-layout-auth-topbar-height)]"
      }`}
    >
      <ShellNavigationToggle isOpen={false} onClick={onOpenNavigation} />
      <div className="ml-auto flex items-center gap-3 sm:gap-5">
        <ShellNotificationButton count={notificationCount} />
        <ShellUserMenu planLabel={planLabel} user={user} />
      </div>
    </header>
  );
}
