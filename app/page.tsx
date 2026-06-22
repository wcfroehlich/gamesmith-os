"use client";

import { useState } from "react";

const fakeStories = [
  {
    title: "Steam Ownership Debate Heats Up Again",
    source: "Steam News",
    storyArc: "Game Ownership",
    contentScore: 92,
    timeScore: 81,
    freshness: "Hot",
    recommended: "Review",
    whyGamersCare:
      "This affects what players actually own when they buy digital games.",
  },
  {
    title: "Pokemon Card Retailers Tighten Purchase Limits",
    source: "Retail / Pokemon",
    storyArc: "Pokemon",
    contentScore: 84,
    timeScore: 72,
    freshness: "Warm",
    recommended: "Monitor",
    whyGamersCare:
      "Scalpers and reseller policies affect normal fans trying to buy cards.",
  },
  {
    title: "AI Tools Continue Changing Creator Workflows",
    source: "OpenAI News",
    storyArc: "AI & Creators",
    contentScore: 88,
    timeScore: 65,
    freshness: "Stable",
    recommended: "Banked",
    whyGamersCare:
      "Creators are using AI to speed up production, editing, and research.",
  },
];

export default function Home() {
  const [stories, setStories] = useState<typeof fakeStories>([]);

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <h1 className="text-4xl font-bold">Gamesmith OS</h1>
      <p className="mt-2 text-slate-300">Editorial Operating System</p>

      <section className="mt-8 rounded-xl border border-slate-700 bg-slate-900 p-6">
        <h2 className="text-2xl font-semibold">Jimmy Research Director</h2>
        <p className="mt-2 text-slate-300">
          Jimmy finds stories, scores them, and prepares them for William&apos;s review.
        </p>

        <button
          onClick={async () => {
            const response = await fetch("/api/gamesmith/run-jimmy");
          
            const data = await response.json();
          
            setStories(data.stories);
          }}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white"
        >
          Run Jimmy
        </button>
      </section>

      <section className="mt-8 grid gap-4">
        {stories.map((story) => (
          <article
            key={story.title}
            className="rounded-xl border border-slate-700 bg-slate-900 p-5"
          >
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded bg-blue-900 px-2 py-1">{story.storyArc}</span>
              <span className="rounded bg-slate-800 px-2 py-1">{story.freshness}</span>
              <span className="rounded bg-slate-800 px-2 py-1">{story.recommended}</span>
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