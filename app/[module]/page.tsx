import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, LockKeyhole, Sparkles } from "lucide-react";
import { AppShell } from "../../components/shell/AppShell";

const modules: Record<string, { title: string; description: string }> = {
  protocol: {
    title: "Protocol",
    description:
      "Personal protocol schedules, adherence, and records arrive in Phase 3.",
  },
  fitness: {
    title: "Fitness",
    description:
      "Training plans, active workouts, and history arrive in Phase 4.",
  },
  sleep: {
    title: "Sleep and recovery",
    description: "Source-aware sleep and readiness records arrive in Phase 5.",
  },
  nutrition: {
    title: "Nutrition",
    description:
      "Flexible nutrition, hydration, and measurement tracking arrives in Phase 7.",
  },
  mindset: {
    title: "Mindset",
    description: "Private reflection and personal direction arrive in Phase 9.",
  },
  finance: {
    title: "Personal finance",
    description:
      "Private accounts, obligations, and transparent calculations arrive in Phase 8.",
  },
  calendar: {
    title: "Calendar",
    description:
      "The full personal time system arrives in Phase 2. Today’s basic agenda already works in Command.",
  },
  atlas: {
    title: "Atlas",
    description:
      "Atlas is not connected yet. Command remains fully usable without an AI provider.",
  },
  vault: {
    title: "Vault",
    description:
      "Secure personal records and permission-aware storage arrive in Phase 10.",
  },
  life: {
    title: "Life",
    description:
      "Personal goals, habits, learning, and meaningful projects arrive in Phase 9.",
  },
  settings: {
    title: "Settings",
    description:
      "Preferences, privacy, security, and integration control arrive in Phase 11.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ module: string }>;
}): Promise<Metadata> {
  const { module } = await params;
  return { title: modules[module]?.title ?? "Nexus OS" };
}

export default async function ModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const detail = modules[module] ?? {
    title: "Not found",
    description: "This personal domain is not part of the current Nexus build.",
  };

  return (
    <AppShell>
      <div className="module-placeholder">
        <div className="module-placeholder__emblem">
          {module === "atlas" ? (
            <Sparkles aria-hidden="true" />
          ) : (
            <LockKeyhole aria-hidden="true" />
          )}
        </div>
        <p className="eyebrow">Prepared, not simulated</p>
        <h1>{detail.title}</h1>
        <p>{detail.description}</p>
        <p className="module-placeholder__note">
          This destination is intentionally honest: no fake records, sync
          status, or decorative controls have been added.
        </p>
        <Link href="/" className="button button--primary">
          <ArrowLeft aria-hidden="true" />
          <span>Return to Command</span>
        </Link>
      </div>
    </AppShell>
  );
}
