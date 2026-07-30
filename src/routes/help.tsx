import { createFileRoute, Link } from "@tanstack/react-router";
import { PortalFooter, PortalHeader } from "@/components/PortalChrome";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const title = "Contact & Help — WILLIE LAB TECH Portal";
const description =
  "Answers to common questions about applying to the Willie Lab Tech engineering empowerment programme.";

export const Route = createFileRoute("/help")({
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
  component: HelpPage,
});

const faqs = [
  {
    q: "What happens after I apply?",
    a: "Your application goes to the admin for review. You can follow its progress at any time from Application Status in your dashboard menu: Submitted → Under Review → Decision Made.",
  },
  {
    q: "How do I know if I'm accepted?",
    a: "You will receive a notification in the portal (the red bell counter will increase) and an email asking you to check the portal. The full decision and any admin feedback appear inside your dashboard.",
  },
  {
    q: "What do I need to submit?",
    a: "Your gender, date of birth, phone number, state, local government area, engineering field, educational qualification, a short description of your skills, at least one document (ID, CV or certificate), and the accuracy confirmation.",
  },
  {
    q: "Can I edit my details after applying?",
    a: "Yes. Open Profile from the top-right menu to update your details at any time.",
  },
  {
    q: "Can I contact the admin?",
    a: "Yes. Use Feedback / Chat in your dashboard menu. Every applicant can message the admin, whether pending, accepted, rejected or employed.",
  },
  {
    q: "When do applications close?",
    a: "Applications run from 29 July 2026 to 10 August 2026. A live countdown is shown on the home page.",
  },
];

function HelpPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PortalHeader subtitle="Help" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <h1 className="text-3xl font-bold text-primary">Contact & Help</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Common questions about the Willie Lab Tech empowerment programme.
        </p>

        <Accordion type="single" collapsible className="mt-6 rounded-xl border bg-card px-4 shadow-soft">
          {faqs.map((faq) => (
            <AccordionItem key={faq.q} value={faq.q}>
              <AccordionTrigger className="text-left font-semibold text-primary">{faq.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">{faq.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="mt-6 rounded-xl border-l-4 border-accent bg-secondary p-5 text-sm">
          <p className="font-semibold text-primary">Still need help?</p>
          <p className="mt-1 text-muted-foreground">
            Log in and send a message from Feedback / Chat in your dashboard menu — the admin replies directly in
            the portal.
          </p>
          <div className="mt-3 flex flex-wrap gap-4">
            <Link to="/login" className="font-semibold text-primary underline">
              Login
            </Link>
            <Link to="/register" className="font-semibold text-primary underline">
              Create an account
            </Link>
            <Link to="/" className="font-semibold text-primary underline">
              Back to home
            </Link>
          </div>
        </div>
      </main>
      <PortalFooter />
    </div>
  );
}
