export type StoryStatus =
  | "Review"
  | "Monitor"
  | "Banked"
  | "Scheduled"
  | "Covered"
  | "Expired"
  | "Archived";

export type SearchMode = "Discovery" | "Arc Watch" | "Adjacency";

export type GamesmithDomain = {
  id: string;
  name: string;
  tier: 1 | 2 | 3;
  description: string;
};

export type SourceRecord = {
  id: string;
  name: string;
  url: string;
  tier: number;
  source_type: string;
  active: boolean;
};

export type ArticleRecord = {
  id: string;
  title: string;
  source: string;
  url?: string;
  summary?: string;
  published_at?: string;
  found_at: string;
};

export type StoryEvent = {
  id: string;
  title: string;
  real_story: string;
  domain: string;
  secondary_domain?: string;
  story_arc: string;
  package_type: string;
  status: StoryStatus;
  content_score: number;
  time_score: number;
  importance_score: number;
  verification_status: string;
  confidence_score: number;
  sponsorship_risk: string;
  bias_risk: string;
  why_gamers_care: string;
  why_it_cannot_be_ignored: string;
  source_count: number;
  article_count: number;
  articles: ArticleRecord[];
  created_at: string;
  updated_at: string;
};

export type StoryArc = {
  id: string;
  title: string;
  domain: string;
  status: StoryStatus;
  watch_terms: string[];
  story_event_ids: string[];
  created_at: string;
  updated_at: string;
};

export type WatchTarget = {
  id: string;
  label: string;
  domain: string;
  story_arc: string;
  search_mode: SearchMode;
  watch_terms: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
};