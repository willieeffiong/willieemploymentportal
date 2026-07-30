import { createFileRoute, Link } from "@tanstack/react-router";
import officeAsset from "@/assets/office.asset.json";
import sponsorAsset from "@/assets/sponsor.asset.json";
import { Button } from "@/components/ui/button";
import { PortalFooter, PortalLogo } from "@/components/PortalChrome";
import { DeadlineCountdown } from "@/components/DeadlineCountdown";
import { ENGINEERING_FIELDS } from "@/lib/portal-data";

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
          <PortalLogo className="h-36 w-36 sm:h-44 sm:w-44" />

          <img
            src={officeAsset.url}
            alt="Engr. Willie Effiong working at his office desk"
            className="mx-auto mt-8 w-full max-w-md rounded-xl border-4 border-accent object-cover shadow-glow"
          />

          <h1 className="mt-8 text-4xl font-bold tracking-wide sm:text-5xl">WILLIE LAB TECH</h1>
          <p className="mt-2 text-sm opacity-90 sm:text-base">
            Employment empowerment portal for young engineers
          </p>

          <div className="mx-auto mt-6 max-w-sm">
            <DeadlineCountdown tone="dark" />
          </div>

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
            <Link to="/help" className="text-sm font-semibold underline opacity-90">
              Contact / Help
            </Link>
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

      <section className="mx-auto max-w-5xl px-4 pb-14">
        <h2 className="text-center text-2xl font-bold text-primary sm:text-3xl">Engineering Fields We Recruit</h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-muted-foreground">
          Twenty engineering disciplines are open for this recruitment drive.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {ENGINEERING_FIELDS.map((field) => (
            <article key={field.name} className="overflow-hidden rounded-xl border bg-card shadow-soft">
              <img
                src={field.image}
                alt={field.name}
                width={768}
                height={512}
                loading="lazy"
                className="h-28 w-full object-cover sm:h-32"
              />
              <div className="p-3">
                <h3 className="text-sm font-bold text-primary">{field.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{field.blurb}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <PortalFooter />
    </div>
  );
}
