"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser";

type PackageArticle = {
  title: string;
  source: string;
  url?: string;
  summary?: string;
};

type TopDriver = {
  label: string;
  score: number;
  max: number;
};

type StoryPackage = {
  story_title: string;
  package_type: string;
  gamesmith_story_type: string;
  secondary_story_type: string;
  real_story: string;
  story_arc: string;
  summary: string;

  primary_source: string;
  supporting_sources: string[];
  sub_events: string[];

  content_scores: {
    consumer_impact: number;
    consequences: number;
    conflict_tension: number;
    ownership_control: number;
    money_incentives: number;
    talent_impact: number;
    ecosystem_impact: number;
    total: number;
  };

  time_scores: {
    urgency: number;
    shelf_life: number;
    momentum: number;
    follow_up_potential: number;
    total: number;
  };

  editorial_importance: {
    score: number;
    reason: string;
  };

  top_drivers: TopDriver[];

  freshness_status: string;
  recommended_state: string;
  expiration_estimate: string;

  why_gamers_care: string;
  who_benefits: string;
  who_pays: string;
  ownership_notes: string;
  talent_notes: string;
  tension_notes: string;
  consequence_notes: string;
  score_reasoning: string;
  recommended_use: string;

  verification_status: string;
  confidence_score: number;
  sponsorship_risk: string;
  bias_risk: string;

  article_count: number;
  source_count: number;
  articles: PackageArticle[];
};

export default function Home() {
  const maintenanceMode =
    process.env.NEXT_PUBLIC_GAMESMITH_MAINTENANCE_MODE === "true";
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [packages, setPackages] = useState<StoryPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exportText, setExportText] = useState("");

  useEffect(() => {
    let mounted = true;
    let supabase: ReturnType<typeof createBrowserSupabaseClient>;

    try {
      supabase = createBrowserSupabaseClient();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Auth is not configured.");
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signIn() {
    setAuthError("");
    setAuthLoading(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setAuthError(error.message);
        setAuthLoading(false);
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Sign in failed.");
      setAuthLoading(false);
    }
  }

  async function signOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    setPackages([]);
    setExportText("");
  }

  function authHeaders(extra?: HeadersInit): HeadersInit {
    if (!session?.access_token) {
      throw new Error("Sign in before using Assignment Desk actions.");
    }

    return {
      ...extra,
      Authorization: `Bearer ${session.access_token}`,
    };
  }

  async function runJimmy() {
    setLoading(true);

    let response: Response;
    try {
      response = await fetch("/api/gamesmith/run-jimmy", {
        method: "POST",
        headers: authHeaders(),
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Jimmy intake failed");
      setLoading(false);
      return;
    }
    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Jimmy intake failed");
      setLoading(false);
      return;
    }

    setPackages(data.stories);
    setLoading(false);
  }

  async function exportBankToBuffer() {
    let response: Response;
    try {
      response = await fetch("/api/gamesmith/export-buffer", {
        headers: authHeaders(),
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Export failed");
      return;
    }

    if (!response.ok) {
      const data = await response.json();
      alert(data.error || "Export failed");
      return;
    }

    const text = await response.text();

    setExportText(text);

    await navigator.clipboard.writeText(text);

    alert("Jimmy Buffer export copied. Paste it into the Jimmy Buffer sheet.");
  }

  if (authLoading) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <h1 className="text-4xl font-bold">Gamesmith OS</h1>
        <p className="mt-4 text-slate-300">Checking Assignment Desk access...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <section className="mx-auto mt-16 max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6">
          <h1 className="text-3xl font-bold">Gamesmith OS</h1>
          {maintenanceMode ? (
            <div className="mt-4 rounded-lg border border-amber-500/50 bg-amber-950/40 p-3 text-sm text-amber-100">
              Gamesmith OS is in a controlled maintenance window. William can
              sign in for migration smoke testing.
            </div>
          ) : (
            <p className="mt-2 text-slate-300">
              Sign in to access the Assignment Desk.
            </p>
          )}

          <div className="mt-6 grid gap-3">
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="Email"
              className="rounded bg-slate-950 px-3 py-2 text-white outline-none ring-1 ring-slate-700 focus:ring-blue-500"
            />
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder="Password"
              className="rounded bg-slate-950 px-3 py-2 text-white outline-none ring-1 ring-slate-700 focus:ring-blue-500"
            />
            {authError && <p className="text-sm text-red-300">{authError}</p>}
            <button
              onClick={signIn}
              className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white"
            >
              Sign In
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <h1 className="text-4xl font-bold">Gamesmith OS</h1>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-slate-300">
        <p>Editorial Operating System</p>
        <button
          onClick={signOut}
          className="rounded bg-slate-800 px-3 py-2 text-sm font-semibold"
        >
          Sign Out
        </button>
      </div>

      {maintenanceMode && (
        <div className="mt-6 rounded-lg border border-amber-500/50 bg-amber-950/40 p-4 text-amber-100">
          Maintenance mode is active. Keep public access paused until the Phase
          1 migration smoke tests pass.
        </div>
      )}

      <section className="mt-8 rounded-xl border border-slate-700 bg-slate-900 p-6">
        <h2 className="text-2xl font-semibold">Jimmy Assignment Desk</h2>
        <p className="mt-2 text-slate-300">
          Jimmy discovers source material, proposes Story candidates, and routes
          them for William&apos;s review inside Gamesmith OS.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={runJimmy}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Running Jimmy..." : "Run Jimmy"}
          </button>

          <button
            onClick={exportBankToBuffer}
            className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white"
          >
            Export Bank to Jimmy Buffer
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-800 p-4">
            <p className="text-sm text-slate-400">Story Packages</p>
            <p className="text-3xl font-bold">{packages.length}</p>
          </div>

          <div className="rounded-lg bg-slate-800 p-4">
            <p className="text-sm text-slate-400">Total Articles</p>
            <p className="text-3xl font-bold">
              {packages.reduce((total, item) => total + item.article_count, 0)}
            </p>
          </div>

          <div className="rounded-lg bg-slate-800 p-4">
            <p className="text-sm text-slate-400">Total Sources</p>
            <p className="text-3xl font-bold">
              {packages.reduce((total, item) => total + item.source_count, 0)}
            </p>
          </div>
        </div>

        {exportText && (
          <div className="mt-5">
            <p className="mb-2 text-sm text-slate-400">
              Copied export preview:
            </p>
            <textarea
              value={exportText}
              readOnly
              className="h-40 w-full rounded bg-slate-950 p-3 text-xs text-slate-200"
            />
          </div>
        )}
      </section>

      <section className="mt-8 grid gap-4">
        {packages.map((storyPackage) => {
          const isExpanded = expanded === storyPackage.story_title;

          return (
            <article
              key={storyPackage.story_title}
              className="rounded-xl border border-slate-700 bg-slate-900 p-5"
            >
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="rounded bg-purple-900 px-2 py-1">
                  {storyPackage.package_type}
                </span>
                <span className="rounded bg-blue-900 px-2 py-1">
                  {storyPackage.gamesmith_story_type}
                </span>
                <span className="rounded bg-slate-800 px-2 py-1">
                  {storyPackage.secondary_story_type}
                </span>
                <span className="rounded bg-slate-800 px-2 py-1">
                  {storyPackage.freshness_status}
                </span>
                <span className="rounded bg-slate-800 px-2 py-1">
                  {storyPackage.recommended_state}
                </span>
              </div>

              <h3 className="mt-3 text-2xl font-bold">
                {storyPackage.story_title}
              </h3>

              <div className="mt-3 rounded border border-slate-700 bg-slate-950 p-4">
                <p className="text-sm font-semibold text-slate-400">
                  Real Story
                </p>
                <p className="mt-1 text-slate-200">
                  {storyPackage.real_story}
                </p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-5">
                <div className="rounded bg-slate-800 p-3">
                  <p className="text-sm text-slate-400">Articles</p>
                  <p className="text-2xl font-bold">
                    {storyPackage.article_count}
                  </p>
                </div>

                <div className="rounded bg-slate-800 p-3">
                  <p className="text-sm text-slate-400">Sources</p>
                  <p className="text-2xl font-bold">
                    {storyPackage.source_count}
                  </p>
                </div>

                <div className="rounded bg-slate-800 p-3">
                  <p className="text-sm text-slate-400">Content</p>
                  <p className="text-2xl font-bold">
                    {storyPackage.content_scores.total} / 100
                  </p>
                </div>

                <div className="rounded bg-slate-800 p-3">
                  <p className="text-sm text-slate-400">Time</p>
                  <p className="text-2xl font-bold">
                    {storyPackage.time_scores.total} / 100
                  </p>
                </div>

                <div className="rounded bg-slate-800 p-3">
                  <p className="text-sm text-slate-400">Importance</p>
                  <p className="text-2xl font-bold">
                    {storyPackage.editorial_importance.score} / 20
                  </p>
                </div>
              </div>

              <p className="mt-4 text-slate-200">
                {storyPackage.why_gamers_care}
              </p>

              <div className="mt-4 rounded border border-slate-700 p-3">
                <p className="text-sm font-semibold text-slate-400">
                  Why It Cannot Be Ignored
                </p>
                <p className="mt-1 text-slate-200">
                  {storyPackage.editorial_importance.reason}
                </p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <div className="rounded border border-slate-700 p-3">
                  <p className="text-sm text-slate-400">Verification</p>
                  <p className="font-semibold">
                    {storyPackage.verification_status}
                  </p>
                </div>

                <div className="rounded border border-slate-700 p-3">
                  <p className="text-sm text-slate-400">Confidence</p>
                  <p className="font-semibold">
                    {storyPackage.confidence_score} / 100
                  </p>
                </div>

                <div className="rounded border border-slate-700 p-3">
                  <p className="text-sm text-slate-400">Sponsorship Risk</p>
                  <p className="font-semibold">
                    {storyPackage.sponsorship_risk}
                  </p>
                </div>

                <div className="rounded border border-slate-700 p-3">
                  <p className="text-sm text-slate-400">Bias Risk</p>
                  <p className="font-semibold">{storyPackage.bias_risk}</p>
                </div>
              </div>

              <div className="mt-4 rounded border border-slate-700 p-3">
                <p className="text-sm font-semibold text-slate-400">
                  Top Drivers
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {storyPackage.top_drivers.map((driver) => (
                    <span
                      key={driver.label}
                      className="rounded bg-slate-800 px-2 py-1 text-sm"
                    >
                      {driver.label}: {driver.score} / {driver.max}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  onClick={async () => {
                    let response: Response;
                    try {
                      response = await fetch("/api/gamesmith/bank-story", {
                        method: "POST",
                        headers: authHeaders({
                          "Content-Type": "application/json",
                        }),
                        body: JSON.stringify(storyPackage),
                      });
                    } catch (error) {
                      alert(
                        error instanceof Error
                          ? error.message
                          : "Story Bank move failed"
                      );
                      return;
                    }

                    if (!response.ok) {
                      const data = await response.json();
                      alert(data.error || "Story Bank move failed");
                      return;
                    }

                    setPackages((current) =>
                      current.filter(
                        (item) => item.story_title !== storyPackage.story_title
                      )
                    );

                    alert("Story banked");
                  }}
                  className="rounded bg-green-600 px-3 py-2 text-sm font-semibold"
                >
                  Move to Story Bank
                </button>

                <button
                  onClick={async () => {
                    let response: Response;
                    try {
                      response = await fetch("/api/gamesmith/reject-story", {
                        method: "POST",
                        headers: authHeaders({
                          "Content-Type": "application/json",
                        }),
                        body: JSON.stringify(storyPackage),
                      });
                    } catch (error) {
                      alert(
                        error instanceof Error ? error.message : "Archive failed"
                      );
                      return;
                    }

                    if (!response.ok) {
                      const data = await response.json();
                      alert(data.error || "Archive failed");
                      return;
                    }

                    setPackages((current) =>
                      current.filter(
                        (item) => item.story_title !== storyPackage.story_title
                      )
                    );

                    alert("Story archived");
                  }}
                  className="rounded bg-red-600 px-3 py-2 text-sm font-semibold"
                >
                  Archive
                </button>

                <button
                  onClick={() =>
                    setExpanded(isExpanded ? null : storyPackage.story_title)
                  }
                  className="rounded bg-slate-700 px-3 py-2 text-sm font-semibold"
                >
                  {isExpanded ? "Hide Details" : "Expand Details"}
                </button>
              </div>

              {isExpanded && (
                <div className="mt-5 rounded-lg border border-slate-700 bg-slate-950 p-4">
                  <h4 className="text-lg font-bold">Source Articles</h4>

                  <div className="mt-3 grid gap-3">
                    {storyPackage.articles.map((article) => (
                      <div
                        key={`${article.source}-${article.title}`}
                        className="rounded border border-slate-800 p-3"
                      >
                        <p className="font-semibold">{article.title}</p>
                        <p className="text-sm text-slate-400">
                          {article.source}
                        </p>

                        {article.summary && (
                          <p className="mt-2 text-sm text-slate-300">
                            {article.summary}
                          </p>
                        )}

                        {article.url && (
                          <a
                            href={article.url}
                            target="_blank"
                            className="mt-2 inline-block text-sm text-blue-400 underline"
                          >
                            Open Article
                          </a>
                        )}
                      </div>
                    ))}
                  </div>

                  <h4 className="mt-5 text-lg font-bold">Score Breakdown</h4>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded border border-slate-800 p-3">
                      <p className="font-semibold">Content Score</p>
                      <p>
                        Consumer Impact:{" "}
                        {storyPackage.content_scores.consumer_impact} / 20
                      </p>
                      <p>
                        Consequences:{" "}
                        {storyPackage.content_scores.consequences} / 20
                      </p>
                      <p>
                        Conflict / Tension:{" "}
                        {storyPackage.content_scores.conflict_tension} / 20
                      </p>
                      <p>
                        Ownership / Control:{" "}
                        {storyPackage.content_scores.ownership_control} / 15
                      </p>
                      <p>
                        Money / Incentives:{" "}
                        {storyPackage.content_scores.money_incentives} / 10
                      </p>
                      <p>
                        Talent Impact:{" "}
                        {storyPackage.content_scores.talent_impact} / 10
                      </p>
                      <p>
                        Ecosystem Impact:{" "}
                        {storyPackage.content_scores.ecosystem_impact} / 5
                      </p>
                      <p className="mt-2 font-bold">
                        Total: {storyPackage.content_scores.total} / 100
                      </p>
                    </div>

                    <div className="rounded border border-slate-800 p-3">
                      <p className="font-semibold">Time Score</p>
                      <p>Urgency: {storyPackage.time_scores.urgency} / 40</p>
                      <p>
                        Shelf Life: {storyPackage.time_scores.shelf_life} / 30
                      </p>
                      <p>Momentum: {storyPackage.time_scores.momentum} / 20</p>
                      <p>
                        Follow-Up:{" "}
                        {storyPackage.time_scores.follow_up_potential} / 10
                      </p>
                      <p className="mt-2 font-bold">
                        Total: {storyPackage.time_scores.total} / 100
                      </p>
                    </div>
                  </div>

                  <h4 className="mt-5 text-lg font-bold">Editorial Notes</h4>

                  <div className="mt-3 grid gap-3">
                    <p>
                      <span className="font-semibold">Primary Source:</span>{" "}
                      {storyPackage.primary_source}
                    </p>
                    <p>
                      <span className="font-semibold">Sub-events:</span>{" "}
                      {storyPackage.sub_events.join(", ") || "None listed"}
                    </p>
                    <p>
                      <span className="font-semibold">Who Benefits:</span>{" "}
                      {storyPackage.who_benefits}
                    </p>
                    <p>
                      <span className="font-semibold">Who Pays:</span>{" "}
                      {storyPackage.who_pays}
                    </p>
                    <p>
                      <span className="font-semibold">Ownership Notes:</span>{" "}
                      {storyPackage.ownership_notes}
                    </p>
                    <p>
                      <span className="font-semibold">Talent Notes:</span>{" "}
                      {storyPackage.talent_notes}
                    </p>
                    <p>
                      <span className="font-semibold">Tension Notes:</span>{" "}
                      {storyPackage.tension_notes}
                    </p>
                    <p>
                      <span className="font-semibold">Consequence Notes:</span>{" "}
                      {storyPackage.consequence_notes}
                    </p>
                    <p>
                      <span className="font-semibold">Score Reasoning:</span>{" "}
                      {storyPackage.score_reasoning}
                    </p>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}
