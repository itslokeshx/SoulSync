import fetch from "node-fetch";

const JIOSAAVN_DIRECT = "https://www.jiosaavn.com/api.php";

async function main() {
  const url = `${JIOSAAVN_DIRECT}?__call=search.getResults&_format=json&_marker=0&ctx=web6dot0&n=5&p=1&q=arijit`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://www.jiosaavn.com/",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
      },
    });
    if (!res.ok) {
      console.log("Response not OK:", res.status);
      return;
    }
    const data = await res.json() as any;
    console.log("Direct search results count:", data?.results?.length);
    if (data?.results?.length > 0) {
      console.log("Sample song keys:", Object.keys(data.results[0]));
      console.log("Sample song more_info keys:", Object.keys(data.results[0].more_info || {}));
      console.log("Sample song more_info details:", JSON.stringify(data.results[0].more_info, null, 2));
    }
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

main();
