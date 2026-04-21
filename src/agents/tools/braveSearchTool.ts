import fetch from "node-fetch";

/**
 * Interface for the Brave Web Search Result
 */
interface BraveWebResult {
  title: string;
  url: string;
  description: string;
  language?: string;
  published?: string;
}

/**
 * Interface for the expected Brave API Response
 */
interface BraveSearchResponse {
  web?: {
    results?: BraveWebResult[];
  };
}

/**
 * Executes a search using the Brave Search API and returns a formatted string.
 * Optimized for Agentic AI context windows.
 * * @param query - The search string provided by the user/agent.
 * @param count - Number of results to return (default: 5).
 * @returns A promise resolving to a formatted string of search results.
 */
export async function braveSearchTool(
  query: string,
  count: number = 5,
): Promise<string> {
  const BRAVE_API_KEY = process.env.BRAVE_API_KEY;

  if (!BRAVE_API_KEY) {
    return "Error: BRAVE_API_KEY is missing from environment variables.";
  }

  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.append("q", query);
  url.searchParams.append("count", Math.min(count, 20).toString()); // Cap at 20 for safety

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": BRAVE_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return `Brave API Error (${response.status}): ${errorText || response.statusText}`;
    }

    const data = (await response.json()) as BraveSearchResponse;
    const results = data.web?.results || [];

    if (results.length === 0) {
      return `No results found for query: "${query}"`;
    }

    // Format the output for the LLM to maximize information density
    const formattedResults = results
      .map((res, index) => {
        const date = res.published ? ` [Published: ${res.published}]` : "";
        return `Result ${index + 1}:
Title: ${res.title}${date}
URL: ${res.url}
Snippet: ${res.description}
`;
      })
      .join("\n---\n");

    return `Search Results for "${query}":\n\n${formattedResults}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Technical Failure during search execution: ${message}`;
  }
}

/**
 * EXAMPLE USAGE:
 * (Ensure you have 'node-fetch' and '@types/node-fetch' installed)
 * * const results = await braveSearchTool("latest AI trends 2026");
 * console.log(results);
 */
