import { useEffect, useState } from "react";
import { APPLICATION_DEADLINE } from "@/lib/portal-data";

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

export function DeadlineCountdown({ tone = "light" }: { tone?: "light" | "dark" }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = now === null ? null : APPLICATION_DEADLINE.getTime() - now;
  const closed = remaining !== null && remaining <= 0;
  const t = parts(remaining ?? 0);

  const box =
    tone === "dark"
      ? "bg-primary-foreground/15 text-primary-foreground"
      : "bg-secondary text-secondary-foreground";

  return (
    <div className="w-full">
      <p className={tone === "dark" ? "text-sm opacity-90" : "text-sm text-muted-foreground"}>
        {closed ? "Applications are now closed" : "Applications close 10 August 2026"}
      </p>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {[
          ["Days", t.days],
          ["Hours", t.hours],
          ["Mins", t.minutes],
          ["Secs", t.seconds],
        ].map(([label, value]) => (
          <div key={label as string} className={`rounded-lg px-2 py-2 text-center ${box}`}>
            <p className="text-xl font-bold tabular-nums sm:text-2xl">
              {now === null ? "--" : String(value).padStart(2, "0")}
            </p>
            <p className="text-[11px] uppercase opacity-80">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
