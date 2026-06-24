import { supabaseAdmin } from "./supabaseAdmin";

export type JimmyMemoryItem = {
  url: string;
  title: string;
  source: string;
  dateSeen: string;
};

export async function loadJimmyMemory(): Promise<JimmyMemoryItem[]> {
  const { data, error } = await supabaseAdmin
    .from("jimmy_memory")
    .select("url,title,source,date_seen");

  if (error) {
    console.error("Failed to load Jimmy memory", error);
    return [];
  }

  return (data || []).map((item) => ({
    url: item.url,
    title: item.title || "",
    source: item.source || "",
    dateSeen: item.date_seen || "",
  }));
}

export async function saveJimmyMemoryItems(items: JimmyMemoryItem[]) {
  if (items.length === 0) return;

  const rows = items.map((item) => ({
    url: item.url,
    title: item.title,
    source: item.source,
    date_seen: item.dateSeen,
  }));

  const { error } = await supabaseAdmin
    .from("jimmy_memory")
    .upsert(rows, { onConflict: "url" });

  if (error) {
    console.error("Failed to save Jimmy memory", error);
  }
}