import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Facebook, Mail, MessageCircleMore, Phone } from "lucide-react";
import { toast } from "sonner";
import { PortalLogo } from "@/components/PortalChrome";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { sendPublicEnquiry } from "@/lib/portal.functions";

const title = "Contact Us — WILLIE LAB TECH Portal";
const description =
  "Reach the Willie Lab Tech team by email, WhatsApp, phone or Facebook, or send a message straight to the admin.";

const FACEBOOK_URL = "https://www.facebook.com/excellentwillie";
const FACEBOOK_APP_URL = "fb://facewebmodal/f?href=https://www.facebook.com/excellentwillie";

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const PHONE_RE = /^\+?[0-9][0-9\s-]{7,17}$/;
const FB_RE = /^(https?:\/\/)?(www\.|m\.|web\.)?facebook\.com\/[^\s]{2,}$/i;

function contactIsValid(value: string) {
  const v = value.trim();
  return EMAIL_RE.test(v) || PHONE_RE.test(v) || FB_RE.test(v);
}

function ContactPage() {
  const [body, setBody] = useState("");
  const [gender, setGender] = useState("");
  const [contact, setContact] = useState("");
  const [touchedContact, setTouchedContact] = useState(false);
  const [sending, setSending] = useState(false);
  const [fbOpen, setFbOpen] = useState(false);

  const contactValid = contactIsValid(contact);
  const ready = body.trim().length >= 5 && Boolean(gender) && contactValid;

  async function send() {
    setSending(true);
    try {
      await sendPublicEnquiry({
        data: { body: body.trim(), gender: gender as "Male" | "Female" | "Other", contact: contact.trim() },
      });
      toast.success("Message sent. The admin will get back to you.");
      setBody("");
      setGender("");
      setContact("");
      setTouchedContact(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send your message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0b0b0b] text-primary-foreground">
      <header className="border-b border-accent/40 bg-gradient-to-r from-[#0b0b0b] via-primary to-[#0b0b0b]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <PortalLogo className="h-11 w-11" />
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-semibold tracking-wide">WILLIE LAB TECH</p>
            <p className="text-[11px] text-accent">Contact & enquiries</p>
          </div>
          <Link to="/" className="ml-auto text-sm font-semibold text-accent underline">
            Home
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <h1 className="text-3xl font-bold sm:text-4xl">
          <span className="text-accent">Contact</span> Us
        </h1>
        <p className="mt-2 text-sm text-primary-foreground/70">
          Need urgent help or want to make an enquiry? Reach us on any channel below.
        </p>

        <div className="mt-8 flex flex-col gap-4">
          <a
            href="mailto:gentlewillie05@gmail.com"
            className="flex items-center gap-4 rounded-xl border border-accent/40 bg-primary/25 p-4 transition-colors hover:bg-primary/40"
          >
            <span className="grid h-11 w-11 place-items-center rounded-full bg-accent text-accent-foreground">
              <Mail className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-xs uppercase tracking-wide text-accent">Email</span>
              <span className="block font-semibold break-all">gentlewillie05@gmail.com</span>
            </span>
          </a>

          <button
            type="button"
            onClick={() => setFbOpen(true)}
            className="flex items-center gap-4 rounded-xl border border-accent/40 bg-primary/25 p-4 text-left transition-colors hover:bg-primary/40"
          >
            <span className="grid h-11 w-11 place-items-center rounded-full bg-primary-foreground text-primary">
              <Facebook className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-xs uppercase tracking-wide text-accent">Facebook</span>
              <span className="block font-semibold break-all">facebook.com/excellentwillie</span>
            </span>
          </button>

          <a
            href="https://wa.me/2347041533954"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-4 rounded-xl border border-accent/40 bg-primary/25 p-4 transition-colors hover:bg-primary/40"
          >
            <span className="grid h-11 w-11 place-items-center rounded-full bg-accent text-accent-foreground">
              <MessageCircleMore className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-xs uppercase tracking-wide text-accent">WhatsApp</span>
              <span className="block font-semibold">+234 704 153 3954</span>
            </span>
          </a>

          <a
            href="tel:+2347041533954"
            className="flex items-center gap-4 rounded-xl border border-accent/40 bg-primary/25 p-4 transition-colors hover:bg-primary/40"
          >
            <span className="grid h-11 w-11 place-items-center rounded-full bg-primary-foreground text-primary">
              <Phone className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-xs uppercase tracking-wide text-accent">Phone call</span>
              <span className="block font-semibold">+234 704 153 3954</span>
            </span>
          </a>
        </div>

        <section className="mt-10 rounded-xl border border-accent/40 bg-primary-foreground p-5 text-foreground shadow-glow sm:p-7">
          <h2 className="text-xl font-bold text-primary">Send a message to the admin</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Prefer not to use the channels above? Write directly through the portal.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <Label htmlFor="enquiry">Your request or message</Label>
              <Textarea
                id="enquiry"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={5}
                maxLength={3000}
                placeholder="Tell us how we can help you…"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="gender">Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger id="gender" className="mt-1">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="contact">Your contact (phone, email or Facebook link)</Label>
              <Input
                id="contact"
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                onBlur={() => setTouchedContact(true)}
                placeholder="+2348012345678, you@email.com or facebook.com/yourname"
                className="mt-1"
              />
              {touchedContact && contact.trim() && !contactValid ? (
                <p className="mt-1 text-sm font-semibold text-destructive">
                  That contact detail is invalid. Enter a valid phone number, email address or Facebook link and
                  try again.
                </p>
              ) : null}
            </div>

            <Button
              onClick={send}
              disabled={!ready || sending}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {sending ? "Sending…" : "Send"}
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-accent/30 py-6 text-center text-xs text-primary-foreground/60">
        Willie Lab Tech Empowerment Portal · Sponsored by Engr. Willie Effiong
      </footer>

      <Dialog open={fbOpen} onOpenChange={setFbOpen}>
        <DialogContent className="text-foreground">
          <DialogHeader>
            <DialogTitle>Open Facebook</DialogTitle>
            <DialogDescription>How would you like to open the Facebook profile?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                setFbOpen(false);
                window.location.href = FACEBOOK_APP_URL;
              }}
            >
              Open with app
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setFbOpen(false);
                window.open(FACEBOOK_URL, "_blank", "noreferrer");
              }}
            >
              Open with browser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
