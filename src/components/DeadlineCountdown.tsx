import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchApplicationPeriod } from "@/lib/portal.functions";

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/** Live countdown that follows the admin-controlled application period. */
export function DeadlineCountdown({ tone = "light" }: { tone?: "light" | "dark" }) {
  const [now, setNow] = useState<number | null>(null);

  const { data: period } = useQuery({
    queryKey: ["application-period"],
    queryFn: () => fetchApplicationPeriod(),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const deadline = period ? new Date(period.deadline) : null;
  const remaining = now === null || !deadline ? null : deadline.getTime() - now;
  const timeUp = remaining !== null && remaining <= 0;
  const closed = Boolean(period && (period.manuallyClosed || timeUp));
  const t = parts(closed ? 0 : (remaining ?? 0));

  const box =
    tone === "dark"
      ? "bg-primary-foreground/15 text-primary-foreground"
      : "bg-secondary text-secondary-foreground";
  const muted = tone === "dark" ? "text-sm opacity-90" : "text-sm text-muted-foreground";

  const deadlineLabel =
    now !== null && deadline
      ? deadline.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })
      : "";

  if (closed) {
    return (
      <div className="w-full rounded-lg border-2 border-destructive bg-destructive/10 px-3 py-4 text-center">
        <p className="text-base font-bold text-destructive">Applications are now closed</p>
        <p className="mt-1 text-sm text-destructive">Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <p className={muted}>{deadlineLabel ? `Applications close ${deadlineLabel}` : "Loading deadline…"}</p>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {[
          ["Days", t.days],
          ["Hours", t.hours],
          ["Mins", t.minutes],
          ["Secs", t.seconds],
        ].map(([label, value]) => (
          <div key={label as string} className={`rounded-lg px-2 py-2 text-center ${box}`}>
            <p className="text-xl font-bold tabular-nums sm:text-2xl">
              {now === null || !period ? "--" : String(value).padStart(2, "0")}
            </p>
            <p className="text-[11px] uppercase opacity-80">{label}</p>
          </div>
        ))}
      </div>
      {period?.change ? (
        <p className={`mt-2 text-center text-xs font-semibold ${tone === "dark" ? "opacity-90" : "text-primary"}`}>
          {period.change}
        </p>
      ) : null}
    </div>
  );
}
