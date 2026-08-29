# GameSmith OS

**AI-assisted research and editorial intelligence system for gaming, technology, creator-economy, and consumer-rights coverage.**

GameSmith OS is an experimental newsroom operating system built to reduce the amount of manual work between discovering a story and deciding whether it deserves editorial attention. The current build centers on **Jimmy**, an AI-assisted research director that ingests RSS sources, evaluates stories against a defined editorial framework, packages related reporting, and produces structured recommendations for review, monitoring, banking, or archiving.

> **Project status:** active prototype. Core research, scoring, packaging, memory, story-bank, and scheduled-run workflows are implemented. The longer-term story-event / story-arc architecture is still under development.

## What the System Does

GameSmith OS currently supports a research pipeline that can:

- ingest configured RSS sources
- filter for recent and previously unseen stories
- evaluate gaming, creator, technology, and consumer-rights relevance with OpenAI
- score stories for both **editorial value** and **time sensitivity**
- group reporting into structured story packages
- identify top editorial drivers and explain why a story matters
- track confidence, verification status, sponsorship risk, and bias risk
- maintain memory so previously processed stories are not repeatedly treated as new
- bank, reject, export, and review story packages through API workflows
- persist scheduled run results to Supabase
- execute a daily research run through Vercel Cron

## Jimmy: AI Research Director

Jimmy is the first worker-agent inside GameSmith OS.

The agent is designed around a constrained editorial role instead of a general-purpose chatbot. It evaluates reporting according to explicit GameSmith priorities and returns structured output for downstream processing.

### Research flow

```text
Configured Sources
      ↓
RSS Ingestion
      ↓
Recent / Unseen Article Filtering
      ↓
AI Story Analysis
      ↓
Story Packaging + Validation
      ↓
Editorial Ranking
      ↓
Review / Monitor / Bank / Archive
```

Jimmy's current story-analysis layer evaluates areas including:

- consumer impact
- consequences
- conflict and tension
- ownership and control
- money and incentives
- talent impact
- ecosystem impact
- urgency
- shelf life
- momentum
- follow-up potential

The code validates and clamps model-generated scores before using them in the final story package, so the workflow does not simply trust arbitrary model output.

## Editorial Intelligence

GameSmith OS separates two different questions that are often mixed together in editorial research:

### Content Score

**Does GameSmith care about this story?**

The current scoring framework emphasizes consumer impact, consequences, conflict, ownership/control, money/incentives, talent impact, and ecosystem effects.

### Time Score

**When does GameSmith care?**

The time model evaluates urgency, shelf life, momentum, and follow-up potential.

These scores are combined with additional editorial-importance logic before a package is promoted for further attention.

## Story Packaging

Rather than presenting a raw feed of links, the system turns reporting into richer **Story Packages**. Current package fields include:

- story title and package type
- primary and supporting sources
- GameSmith story type and story arc
- the underlying "real story"
- article and source counts
- detailed content-score breakdown
- detailed time-score breakdown
- editorial-importance score and reasoning
- top editorial drivers
- freshness and recommended state
- why gamers care
- who benefits / who pays
- ownership, talent, tension, and consequence notes
- verification status
- confidence score
- sponsorship risk
- bias risk
- recommended editorial use

## Memory and Research Operations

Jimmy keeps a memory of processed stories and checks incoming article URLs against that history before sending them through the analysis pipeline. This reduces duplicate research and creates the basis for longer-term story tracking.

The current development direction expands that model from individual articles into durable editorial intelligence:

```text
Source → Article → Story Event → Story Arc → GameSmith Domain
```

The planned memory architecture separates:

- **Story Bank** — approved recent discoveries
- **Story Vault** — durable stories and long-running arcs
- **Watch List** — active events and arcs requiring continued monitoring

## Scheduled Automation

The repository includes a Vercel Cron configuration for a daily research run. The scheduled endpoint executes Jimmy, stores the resulting package count and story data in Supabase, and records failed runs for troubleshooting.

## Technology

**Application**

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS

**AI / Data Processing**

- OpenAI API
- RSS Parser
- deterministic score validation and normalization

**Data / Infrastructure**

- Supabase
- PostgreSQL-backed persistence
- Vercel
- Vercel Cron

## Repository Structure

```text
agents/jimmy/     Jimmy research-agent logic, analysis and packaging
app/              Next.js interface
app/api/          API workflows and scheduled research endpoints
data/             source and Jimmy configuration data
docs/             development notes and architecture direction
lib/              persistence, memory and shared application logic
```

## Security and Configuration

Secrets are loaded from environment variables rather than hard-coded into the repository. The project `.gitignore` excludes `.env*`, private key files, Vercel state, dependencies, build output, and common debug artifacts.

Server-side integrations use environment variables for services such as OpenAI and Supabase. A production deployment should provide the appropriate environment configuration through the hosting platform rather than committing credentials to source control.

## Running Locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

A fully functional local environment also requires the server-side environment variables used by the OpenAI, Supabase, and scheduled-job integrations.

## Development Direction

The current prototype proves the article-discovery and editorial-evaluation pipeline. The next architecture phase moves beyond isolated articles toward persistent **Story Events**, **Story Arcs**, and **GameSmith Domains**, allowing the system to understand continuing stories rather than rediscovering them as disconnected headlines.

Planned research modes include:

1. **Discovery Search** — What is new?
2. **Arc Watch Search** — What changed in stories already being followed?
3. **Adjacency Search** — What happened outside gaming that could materially affect gaming or creators?

## Why I Built It

GameSmith OS is an experiment in combining newsroom judgment, structured operating rules, automation, and AI without handing editorial decisions entirely to a language model. The goal is to use AI where it is useful — discovery, classification, comparison, summarization, and structured analysis — while retaining explicit scoring rules, validation, traceable source material, and human review for actual editorial decisions.

---

Built by **William Gamesmith / William Froehlich** as part of the broader GameSmith media and AI workflow project.
