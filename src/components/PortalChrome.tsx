import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/logo.asset.json";

export function PortalHeader({ subtitle }: { subtitle?: string }) {
  return (
    <header className="bg-hero text-primary-foreground shadow-soft">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-3">
          <img
            src={logoAsset.url}
            alt="Will's Photographic Studio Ltd logo"
            className="h-11 w-11 rounded-full ring-2 ring-accent"
          />
          <span className="font-display text-lg leading-none font-semibold tracking-wide sm:text-xl">
            WILLIE LAB TECH
          </span>
        </Link>
        {subtitle ? (
          <span className="ml-auto rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
            {subtitle}
          </span>
        ) : null}
      </div>
    </header>
  );
}

export function PortalFooter() {
  return (
    <footer className="mt-12 border-t bg-secondary">
      <div className="mx-auto max-w-5xl px-4 py-6 text-center text-sm text-muted-foreground">
        Willie Lab Tech Empowerment Portal · Sponsored by Engr. Willie Effiong
      </div>
    </footer>
  );
}
