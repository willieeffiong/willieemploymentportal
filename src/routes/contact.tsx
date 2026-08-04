import { createFileRoute, Link } from "@tanstack/react-router";
import { ContactPanel } from "@/components/ContactPanel";
import { PortalLogo } from "@/components/PortalChrome";

const title = "Contact Us — WILLIE LAB TECH Portal";
const description =
  "Reach the Willie Lab Tech team by email, WhatsApp, phone or Facebook, or send a message straight to the admin.";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#0b0b0b] text-primary-foreground">
      <header className="border-b border-accent/40 bg-gradient-to-r from-[#0b0b0b] via-primary to-[#0b0b0b]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <PortalLogo className="h-11 w-11" />
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-semibold tracking-wide">WILLIE LAB TECH</p>
            <p className="text-[11px] text-accent">Contact &amp; enquiries</p>
          </div>
          <Link to="/" className="ml-auto text-sm font-semibold text-accent underline">
            Home
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <ContactPanel />
      </main>

      <footer className="border-t border-accent/30 py-6 text-center text-xs text-primary-foreground/60">
        Willie Lab Tech Empowerment Portal · Sponsored by Engr. Willie Effiong
      </footer>
    </div>
  );
}
