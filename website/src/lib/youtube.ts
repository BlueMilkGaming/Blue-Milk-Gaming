// Latest videos from the YouTube channel RSS feed (no API key needed).
// The feed shape is stable, so a small regex parse beats pulling in an XML dep.

const CHANNEL_ID = "UC718Hy10-4tIndu2zVTS9LA"; // @BlueMilkGaming
const FEED = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

export type Video = {
  id: string;
  title: string;
  published: string; // ISO
  thumbnail: string;
  url: string;
};

// Exported for the self-check; not part of the public surface otherwise.
export function parseFeed(xml: string, limit = 6): Video[] {
  const entries = xml.split("<entry>").slice(1);
  const videos: Video[] = [];
  for (const entry of entries) {
    const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const title = entry.match(/<media:title>([^<]+)<\/media:title>/)?.[1]
      ?? entry.match(/<title>([^<]+)<\/title>/)?.[1];
    const published = entry.match(/<published>([^<]+)<\/published>/)?.[1];
    const thumbnail = entry.match(/<media:thumbnail url="([^"]+)"/)?.[1];
    if (!id || !title || !published) continue;
    videos.push({
      id,
      title: decodeEntities(title),
      published,
      thumbnail: thumbnail ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${id}`,
    });
    if (videos.length >= limit) break;
  }
  return videos;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Returns [] on any failure so the page degrades to a "watch on YouTube" link
// rather than throwing.
export async function getLatestVideos(limit = 6): Promise<Video[]> {
  try {
    const res = await fetch(FEED, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    return parseFeed(await res.text(), limit);
  } catch {
    return [];
  }
}
