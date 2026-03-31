import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const API_KEY = process.env.GNEWS_API_KEY;
  const debug: string[] = [];

  // Step 1: Check API key
  if (!API_KEY) {
    debug.push("FAIL: GNEWS_API_KEY is not set");
    // Also check if it's under the old name
    const oldKey = process.env.VITE_GNEWS_API_KEY;
    if (oldKey) {
      debug.push("FOUND: VITE_GNEWS_API_KEY exists (wrong name, should be GNEWS_API_KEY)");
    }
    return res.status(200).json({ stories: [], count: 0, debug });
  }

  debug.push("OK: API key found, length=" + API_KEY.length);

  // Step 2: Try one simple GNews request
  const testQuery = "breakthrough";
  const testUrl = `https://gnews.io/api/v4/search?q=${testQuery}&lang=en&max=5&apikey=${API_KEY}`;
  debug.push("Fetching: " + testUrl.replace(API_KEY, "KEY_HIDDEN"));

  try {
    const fetchRes = await fetch(testUrl);
    debug.push("HTTP status: " + fetchRes.status);

    const text = await fetchRes.text();
    debug.push("Response length: " + text.length + " chars");
    debug.push("Response preview: " + text.substring(0, 500));

    // Try to parse
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      debug.push("FAIL: Could not parse JSON");
      return res.status(200).json({ stories: [], count: 0, debug });
    }

    if (data.errors) {
      debug.push("GNews errors: " + JSON.stringify(data.errors));
      return res.status(200).json({ stories: [], count: 0, debug });
    }

    if (!data.articles || data.articles.length === 0) {
      debug.push("No articles returned");
      return res.status(200).json({ stories: [], count: 0, debug });
    }

    debug.push("Articles found: " + data.articles.length);

    // Build stories from this test
    const stories = data.articles.map((a: any, i: number) => ({
      title: a.title,
      description: a.description || "",
      url: a.url,
      image: a.image,
      publishedAt: a.publishedAt,
      source: a.source?.name || "Unknown",
      category: "science",
    }));

    return res.status(200).json({
      stories,
      count: stories.length,
      debug,
    });
  } catch (err: any) {
    debug.push("FETCH ERROR: " + err.message);
    return res.status(200).json({ stories: [], count: 0, debug });
  }
}
