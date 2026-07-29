import { createFileRoute, Link } from "@tanstack/react-router";
import logoAsset from "@/assets/logo.asset.json";
import officeAsset from "@/assets/office.asset.json";
import sponsorAsset from "@/assets/sponsor.asset.json";
import { Button } from "@/components/ui/button";
import { PortalFooter } from "@/components/PortalChrome";

const title = "WILLIE LAB TECH — Engineering Empowerment Portal";
const description =
  "Apply for the Willie Lab Tech empowerment for young engineers. 10,000 slots open from 29 July to 10 August 2026. Sponsored by Engr. Willie Effiong.";

export const Route = createFileRoute("/")({
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
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-hero pb-10 text-primary-foreground">
        <div className="mx-auto max-w-3xl px-4 pt-10 text-center">
          <img
            src={logoAsset.url}
            alt="Will's Photographic Studio Ltd logo"
            className="mx-auto h-36 w-36 rounded-full ring-4 ring-accent sm:h-44 sm:w-44"
          />

          <img
            src={officeAsset.url}
            alt="Engr. Willie Effiong working at his office desk"
            className="mx-auto mt-8 w-full max-w-md rounded-xl border-4 border-accent object-cover shadow-glow"
            loading="lazy"
          />

          <h1 className="mt-8 text-4xl font-bold tracking-wide sm:text-5xl">WILLIE LAB TECH</h1>
          <p className="mt-2 text-sm opacity-90 sm:text-base">
            Employment empowerment portal for young engineers
          </p>

          <div className="mx-auto mt-8 flex max-w-sm flex-col gap-3">
            <Button
              asChild
              size="lg"
              className="bg-accent text-accent-foreground shadow-glow hover:bg-accent/90"
            >
              <Link to="/register">Apply Now</Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="border-2 border-primary-foreground/60 bg-primary text-primary-foreground hover:bg-primary/80"
            >
              <Link to="/login">Login (Already have an account)</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-primary-foreground/50 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link to="/admin-login">Login as Admin</Link>
            </Button>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-3xl px-4 py-12">
        <h2 className="text-center text-2xl font-bold text-primary sm:text-3xl">About This Empowerment</h2>
        <div className="mt-5 rounded-xl border-l-4 border-accent bg-secondary p-5 leading-relaxed text-foreground shadow-soft sm:p-7">
          <p>
            This empowerment is from Willie Lab Tech to empower young engineers to fit into their field
            and find opportunities to make their dreams come true. This empowerment is currently
            requesting for 10,000 engineers from different fields, and applications start from 29th of
            July to 10th of August 2026. This empowerment is sponsored by Engr. Willie Effiong.
          </p>
        </div>

        <figure className="mt-10">
          <img
            src={sponsorAsset.url}
            alt="Engr. Willie Effiong standing in front of a gated property"
            className="mx-auto w-full max-w-md rounded-xl border-4 border-primary object-cover shadow-soft"
            loading="lazy"
          />
          <figcaption className="mt-3 text-center text-sm font-medium text-muted-foreground">
            Sponsor — Engr. Willie Effiong
          </figcaption>
        </figure>
      </section>

      <PortalFooter />
    </div>
  );
}
