import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, Menu } from "lucide-react";
import logoAsset from "@/assets/logo.asset.json";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function PortalLogo({ className = "h-11 w-11" }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-foreground ring-2 ring-accent ${className}`}
    >
      <img
        src={logoAsset.url}
        alt="Willie Lab Tech logo"
        className="h-full w-full scale-105 rounded-full object-cover"
      />
    </span>
  );
}

export function PortalHeader({ subtitle }: { subtitle?: string }) {
  return (
    <header className="bg-hero text-primary-foreground shadow-soft">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <PortalLogo />
          <span className="truncate font-display text-lg leading-none font-semibold tracking-wide sm:text-xl">
            WILLIE LAB TECH
          </span>
        </Link>
        {subtitle ? (
          <span className="ml-auto shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
            {subtitle}
          </span>
        ) : null}
      </div>
    </header>
  );
}

export interface MenuItem {
  key: string;
  label: string;
}

export function PortalAppHeader({
  subtitle,
  items,
  active,
  unread,
  onSelect,
  onLogout,
}: {
  subtitle: string;
  items: MenuItem[];
  active: string;
  unread: number;
  onSelect: (key: string) => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);

  function pick(key: string) {
    setOpen(false);
    onSelect(key);
  }

  return (
    <header className="sticky top-0 z-40 bg-hero text-primary-foreground shadow-soft">
      <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => onSelect("home")}
          className="flex min-w-0 items-center gap-3 text-left"
        >
          <PortalLogo className="h-10 w-10" />
          <span className="min-w-0">
            <span className="block truncate font-display text-base leading-tight font-semibold tracking-wide sm:text-xl">
              WILLIE LAB TECH
            </span>
            <span className="block truncate text-[11px] opacity-90">{subtitle}</span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
            onClick={() => onSelect("notifications")}
            className="relative rounded-full p-2 transition-colors hover:bg-primary-foreground/15"
          >
            <Bell className="h-5 w-5" />
            {unread > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground">
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open menu"
                className="rounded-full p-2 transition-colors hover:bg-primary-foreground/15"
              >
                <Menu className="h-6 w-6" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-card p-0">
              <SheetHeader className="bg-hero px-4 py-4 text-primary-foreground">
                <SheetTitle className="text-primary-foreground">Menu</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col p-2">
                {items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => pick(item.key)}
                    className={`flex items-center justify-between rounded-md px-3 py-3 text-left text-sm font-medium transition-colors hover:bg-secondary ${
                      active === item.key ? "bg-secondary text-primary" : "text-foreground"
                    }`}
                  >
                    {item.label}
                    {item.key === "notifications" && unread > 0 ? (
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground">
                        {unread}
                      </span>
                    ) : null}
                  </button>
                ))}
                <Button
                  className="mt-3 bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={() => {
                    setOpen(false);
                    onLogout();
                  }}
                >
                  Logout
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

/**
 * Site footer. Inside a dashboard, pass `onContact` so Contact Us opens in the
 * logged-in session instead of navigating away to the public page.
 */
export function PortalFooter({ onContact }: { onContact?: () => void }) {
  return (
    <footer className="mt-12 border-t bg-secondary">
      <div className="mx-auto max-w-5xl px-4 py-6 text-center text-sm text-muted-foreground">
        Willie Lab Tech Empowerment Portal · Sponsored by Engr. Willie Effiong
        <div className="mt-5">
          {onContact ? (
            <Button
              size="lg"
              onClick={onContact}
              className="w-full max-w-xs bg-accent text-base font-bold text-accent-foreground shadow-glow hover:bg-accent/90"
            >
              Need help? Contact Us
            </Button>
          ) : (
            <Button
              asChild
              size="lg"
              className="w-full max-w-xs bg-accent text-base font-bold text-accent-foreground shadow-glow hover:bg-accent/90"
            >
              <Link to="/contact">Need help? Contact Us</Link>
            </Button>
          )}
          <p className="mt-2 text-xs">Email, WhatsApp, Facebook or send a message to the admin.</p>
        </div>
      </div>
    </footer>
  );
}


