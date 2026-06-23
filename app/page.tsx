"use client";

import { useState } from "react";

type Story = {
  title: string;
  source: string;
  storyArc: string;
  contentScore: number;
  timeScore: number;
  freshness: string;
  recommended: string;
  whyGamersCare: string;
};

export default function Home() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function runJimmy() {
    setLoading(true);

    const response = await fetch("/api/gamesmith/run-jimmy");
    const data = await response.json();

    setStories(data.stories);
    setLoading(false);
  }

  async function resetMemory() {
    setResetting(true);

    await fetch("/api/gamesmith/reset-memory", {
      method: "POST",
    });

    setStories([]);
    setResetting(false);
    alert("Jimmy memory cleared");
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <h1 className="text-4xl font-bold">Gamesmith OS</h1>
      <p className="mt-2 text-slate-300">Editorial Operating System</p>

      <section className="mt-8 rounded-xl border border-slate-700 bg-slate-900 p-6">
        <h2 className="text-2xl font-semibold">Jimmy Research Director</h2>
        <p className="mt-2 text-slate-300">
          Jimmy finds stories, scores them, and prepares them for William&apos;s
          review.
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
            onClick={resetMemory}
            disabled={resetting}
            className="rounded-lg bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {resetting ? "Resetting..." : "Reset Jimmy Memory"}
          </button>
        </div>
      </section>

      <section className="mt-8 grid gap-4">
        {stories.map((story) => (
          <article
            key={`${story.source}-${story.title}`}
            className="rounded-xl border border-slate-700 bg-slate-900 p-5"
          >
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded bg-blue-900 px-2 py-1">
                {story.storyArc}
              </span>
              <span className="rounded bg-slate-800 px-2 py-1">
                {story.freshness}
              </span>
              <span className="rounded bg-slate-800 px-2 py-1">
                {story.recommended}
              </span>
            </div>

            <h3 className="mt-3 text-2xl font-bold">{story.title}</h3>
            <p className="mt-1 text-sm text-slate-400">{story.source}</p>

            <div className="mt-4 flex gap-4">
              <div>
                <p className="text-sm text-slate-400">Content</p>
                <p className="text-2xl font-bold">{story.contentScore}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Time</p>
                <p className="text-2xl font-bold">{story.timeScore}</p>
              </div>
            </div>

            <p className="mt-4 text-slate-200">{story.whyGamersCare}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              <button className="rounded bg-green-600 px-3 py-2 text-sm font-semibold">
                Approve
              </button>
              <button className="rounded bg-yellow-600 px-3 py-2 text-sm font-semibold">
                Monitor
              </button>
              <button className="rounded bg-red-600 px-3 py-2 text-sm font-semibold">
                Reject
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}