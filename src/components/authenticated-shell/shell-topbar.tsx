import { ShellNavigationToggle } from "./authenticated-shell";
import { ShellNotificationButton } from "./shell-notification-button";
import { ShellUserMenu } from "./shell-user-menu";

import type { ShellUser } from "./authenticated-shell";

export function ShellTopbar({
  notificationCount,
  onOpenNavigation,
  user,
}: {
  notificationCount: number;
  onOpenNavigation: () => void;
  user: ShellUser;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-[var(--tes-layout-auth-topbar-height)] items-center justify-between bg-[var(--tes-color-background)] px-4 sm:px-6 lg:px-8">
      <ShellNavigationToggle isOpen={false} onClick={onOpenNavigation} />
      <div className="ml-auto flex items-center gap-3 sm:gap-5">
        <ShellNotificationButton count={notificationCount} />
        <ShellUserMenu user={user} />
      </div>
    </header>
  );
}
