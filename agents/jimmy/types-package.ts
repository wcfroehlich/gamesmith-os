export type PackageArticle = {
    title: string;
    source: string;
    url?: string;
    summary?: string;
  };
  
  export type ArticleForPackaging = {
    title: string;
    source: string;
    url?: string;
    summary?: string;
    storyArc: string;
    contentScore: number;
    timeScore: number;
    freshness: string;
    recommended: string;
    whyGamersCare: string;
  };
  
  export type ContentScores = {
    consumer_impact: number;
    consequences: number;
    conflict_tension: number;
    ownership_control: number;
    money_incentives: number;
    talent_impact: number;
    ecosystem_impact: number;
    total: number;
  };
  
  export type TimeScores = {
    urgency: number;
    shelf_life: number;
    momentum: number;
    follow_up_potential: number;
    total: number;
  };
  
  export type TopDriver = {
    label: string;
    score: number;
    max: number;
  };
  
  export type EditorialImportance = {
    score: number;
    reason: string;
  };
  
  export type StoryPackage = {
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
  
    content_scores: ContentScores;
    time_scores: TimeScores;
    editorial_importance: EditorialImportance;
  
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