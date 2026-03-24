import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Proxy Routes to gather "Signals"
  app.get("/api/signals", async (req, res) => {
    try {
      // Fetch data from multiple sources in parallel
      const [
        hn, crypto, space, weather, countries, art, anime, security, books,
        military, emergency, spaceWeather, science, politics, religion, energy, ai,
        social, trending, software, demographics, labor
      ] = await Promise.allSettled([
        axios.get("https://hacker-news.firebaseio.com/v0/topstories.json").then(async (r) => {
           const ids = r.data.slice(0, 10);
           return Promise.all(ids.map(id => axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(res => res.data)));
        }),
        axios.get("https://api.coincap.io/v2/assets?limit=10").then(r => r.data.data),
        axios.get("https://api.spaceflightnewsapi.net/v4/articles/?limit=5").then(r => r.data.results),
        axios.get("https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current_weather=true").then(r => r.data.current_weather),
        axios.get("https://restcountries.com/v3.1/all").then(r => r.data.slice(0, 10)),
        axios.get("https://api.artic.edu/api/v1/artworks?limit=5").then(r => r.data.data),
        axios.get("https://api.jikan.moe/v4/random/anime").then(r => r.data.data),
        axios.get("https://urlhaus-api.abuse.ch/v1/urls/recent/").then(r => r.data.urls?.slice(0, 5)),
        axios.get("https://openlibrary.org/subjects/mystery.json?limit=5").then(r => r.data.works),
        axios.get("https://api.reliefweb.int/v1/reports?appname=min-coincidence&limit=5&filter[field]=theme&filter[value]=Conflict%20and%20Violence").then(r => r.data.data),
        axios.get("https://api.reliefweb.int/v1/disasters?appname=min-coincidence&limit=5").then(r => r.data.data),
        axios.get("https://services.swpc.noaa.gov/json/planetary_k_index_1m.json").then(r => r.data.slice(-5)),
        axios.get("https://api.crossref.org/works?rows=5&sort=published&order=desc").then(r => r.data.message.items),
        axios.get("https://en.wikipedia.org/api/rest_v1/feed/featured/2026/03/20").then(r => r.data.onthisday?.slice(0, 5)),
        axios.get("https://api.aladhan.com/v1/timingsByCity?city=London&country=UK&method=2").then(r => r.data.data.date.hijri),
        axios.get("https://api.carbonintensity.org.uk/intensity").then(r => r.data.data[0]),
        axios.get("https://hacker-news.firebaseio.com/v0/search?query=AI").catch(() => ({ data: { hits: [] } })).then(r => (r as any).data?.hits?.slice(0, 5)),

        // New Sources
        axios.get("https://www.reddit.com/r/all/hot.json?limit=5").then(r => r.data.data.children.map((c: any) => c.data)), // Social Hype
        axios.get("https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/2026/03/19").then(r => r.data.items[0].articles.slice(0, 5)), // Trending News (Wiki)
        axios.get("https://api.github.com/search/repositories?q=stars:>1000&sort=updated&order=desc&per_page=5").then(r => r.data.items), // Software (GitHub)
        axios.get("https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&per_page=10").then(r => r.data[1]), // Demographics
        axios.get("https://api.worldbank.org/v2/indicator/SL.UEM.TOTL.ZS?format=json&per_page=10").then(r => r.data[1]) // Labor (Unemployment)
      ]);

      res.json({
        news: hn.status === 'fulfilled' ? hn.value : [],
        finance: crypto.status === 'fulfilled' ? crypto.value : [],
        space: space.status === 'fulfilled' ? space.value : [],
        weather: weather.status === 'fulfilled' ? weather.value : null,
        geography: countries.status === 'fulfilled' ? countries.value : [],
        art: art.status === 'fulfilled' ? art.value : [],
        entertainment: anime.status === 'fulfilled' ? anime.value : null,
        security: security.status === 'fulfilled' ? security.value : [],
        culture: books.status === 'fulfilled' ? books.value : [],
        military: military.status === 'fulfilled' ? military.value : [],
        emergency: emergency.status === 'fulfilled' ? emergency.value : [],
        spaceWeather: spaceWeather.status === 'fulfilled' ? spaceWeather.value : [],
        science: science.status === 'fulfilled' ? science.value : [],
        politics: politics.status === 'fulfilled' ? politics.value : [],
        religion: religion.status === 'fulfilled' ? religion.value : null,
        energy: energy.status === 'fulfilled' ? energy.value : null,
        ai: ai.status === 'fulfilled' ? ai.value : [],

        // New Signal Fields
        social: social.status === 'fulfilled' ? social.value : [],
        trending: trending.status === 'fulfilled' ? trending.value : [],
        software: software.status === 'fulfilled' ? software.value : [],
        demographics: demographics.status === 'fulfilled' ? demographics.value : [],
        labor: labor.status === 'fulfilled' ? labor.value : [],
        
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching signals:", error);
      res.status(500).json({ error: "Failed to fetch signals" });
    }
  });

  // New endpoint for v3.1 Deep API collection
  app.get("/api/sources/fetch", async (req, res) => {
    try {
      const sources = [
        { id: "arxiv", url: "http://export.arxiv.org/api/query?search_query=all:quantum+OR+all:anomaly&max_results=3", type: "xml" },
        { id: "nasa", url: "https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY", type: "json" },
        { id: "usgs", url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson", type: "json" },
        { id: "hn", url: "https://hacker-news.firebaseio.com/v0/topstories.json", type: "hn" },
        { id: "wiki", url: "https://en.wikipedia.org/w/api.php?action=query&list=recentchanges&rcprop=title|ids|timestamp&format=json&origin=*", type: "json" }
      ];

      const results = await Promise.allSettled(sources.map(async (s) => {
        const response = await axios.get(s.url);
        if (s.id === 'hn') {
          const ids = response.data.slice(0, 5);
          const details = await Promise.all(ids.map(id => axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r => r.data)));
          return { id: s.id, data: details };
        }
        return { id: s.id, data: response.data };
      }));

      const signals = results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as any).value);

      res.json({ signals, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("Error fetching deep sources:", error);
      res.status(500).json({ error: "Failed to fetch deep sources" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
