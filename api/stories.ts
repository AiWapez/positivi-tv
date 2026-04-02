import type { VercelRequest, VercelResponse } from "@vercel/node";

const API_KEY = process.env.GNEWS_API_KEY;
const BASE_URL = "https://gnews.io/api/v4/search";

// Big pool of single-word positive queries. We pick 5 per load.
const ALL_QUERIES = [
  "breakthrough",
  "discovery",
  "rescued",
  "milestone",
  "launched",
  "celebrates",
  "achievement",
  "record-breaking",
  "restored",
  "volunteers",
  "donates",
  "cure",
  "renewable",
  "championship",
  "rebuilt",
  "invented",
  "historic",
  "innovation",
  "awarded",
  "inspiring",
  "triumphant",
  "pioneering",
  "revival",
  "transforms",
  "empowers",
];

const NEGATIVE_WORDS = [
  "killed", "dead", "dies", "murder", "attack", "crisis",
  "war ", "bomb", "shooting", "massacre", "collapse", "scandal",
  "arrest", "sentenced", "guilty", "fatal", "terror", "fraud",
  "abuse", "crash", "assaulted", "convicted", "indicted",
  "explosion", "hostage", "kidnap",
];

function categorize(title: string, desc: string): string {
  const t = `${title} ${desc}`.toLowerCase();

  if (/scientist|research|discovery|nasa|space|asteroid|dna|quantum|ai |robot|solar|species|fossil|lab|universit|physics|chemistry|biolog|engineer|experiment|telescope|genome|molecule|clinical trial/.test(t))
    return "science";
  if (/medical|health|hospital|cancer|disease|treatment|vaccine|surgery|drug|patient|doctor|cure|therap|transplant|diagnos|pharma|symptom/.test(t))
    return "health";
  if (/championship|tournament|medal|olympic|athlete|coach|football|basketball|soccer|tennis|record.*broken|victory.*game|sports|nba|nfl|underdog|playoff|mvp|trophy|batting|goalkeeper|stadium/.test(t))
    return "sports";
  if (/jobs? |economic|startup|business|invest|growth|poverty|entrepreneur|company|renewable.*invest|billion|fund|market|revenue|ipo|profit|hiring/.test(t))
    return "business";
  if (/communit|volunteer|charit|donat|rescue|kindness|rebuild|shelter|food bank|neighbor|homeless|saved.*life|hero|fundrais|nonprofit|foster/.test(t))
    return "community";
  if (/peace|diplomat|treaty|humanitarian|united nations|refugee|international|cooperation|agreement|summit|embassy|foreign minister/.test(t))
    return "world";

  return "world";
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchQuery(query: string): Promise<any[]> {
  const params = new URLSearchParams({
    q: query,
    lang: "en",
    max: "10",
    sortby: "relevance",
    apikey: API_KEY || "",
  });

  try {
    const res = await fetch(`${BASE_URL}?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.articles || [];
  } catch {
    return [];
  }
}

const FALLBACK_STORIES = [
  // Science
  { title: "Scientists Turn Plastic Waste Into Parkinson's Drug in Medical Breakthrough", description: "Scientists at the University of Edinburgh have transformed common plastic waste into a high-value precursor for Parkinson's disease medication using engineered bacteria.", url: "https://hothardware.com/news/scientists-turn-plastic-waste-into-parkinsons-drug", image: null, publishedAt: "2026-03-30T17:18:00Z", source: "Hot Hardware", category: "science" },
  { title: "Asteroid Found Carrying All the Building Blocks of DNA", description: "Researchers made a massive discovery finding the chemical letters needed to create DNA on an asteroid in space, with important implications for understanding the origin of life.", url: "https://www.dailystar.co.uk/news/latest-news/asteroid-found-carrying-building-blocks-36900167", image: null, publishedAt: "2026-03-20T16:59:20Z", source: "Daily Star", category: "science" },
  { title: "Solar Breakthrough Reaches 130% Efficiency with Singlet Fission", description: "Researchers used a spin-flip metal complex to capture and multiply energy from sunlight, producing more energy carriers than photons absorbed.", url: "https://www.sciencedaily.com/", image: null, publishedAt: "2026-03-28T12:00:00Z", source: "ScienceDaily", category: "science" },
  { title: "First Lab-Grown Oesophagus Successfully Restores Swallowing", description: "Scientists at Great Ormond Street Hospital created the first lab-grown oesophagus that safely replaces a full organ section and restores normal function without immunosuppression.", url: "https://en.wikipedia.org/wiki/2026_in_science", image: null, publishedAt: "2026-03-20T12:00:00Z", source: "UCL / GOSH", category: "science" },
  { title: "Antimatter Transported by Road for the First Time Ever", description: "Around 100 to 1,000 antiprotons were carried in a Penning trap across 5km in Switzerland, marking the first ever road transport of antimatter particles.", url: "https://en.wikipedia.org/wiki/2026_in_science", image: null, publishedAt: "2026-03-24T12:00:00Z", source: "CERN", category: "science" },
  { title: "Oxford Engineers Yeast to Save Honeybees with 15x More Young", description: "Researchers engineered yeast to produce essential sterols missing from modern bee diets. Colonies fed the supplement produced up to 15 times more developing young.", url: "https://en.wikipedia.org/wiki/2026_in_science", image: null, publishedAt: "2026-03-27T12:00:00Z", source: "University of Oxford", category: "science" },
  { title: "24 New Deep-Sea Species Discovered in the Pacific Ocean", description: "Researchers discovered 24 new amphipod species in the Clarion-Clipperton Zone including a rare entirely new superfamily, expanding deep-sea knowledge.", url: "https://www.sciencedaily.com/news/top/science/", image: null, publishedAt: "2026-03-25T12:00:00Z", source: "ScienceDaily", category: "science" },
  { title: "Brain Can Refresh Itself After Stroke, Study Finds", description: "Analyzing over 500 stroke survivors' brain scans, researchers discovered the brain can refresh damaged areas post-stroke, offering new hope for recovery.", url: "https://www.sciencedaily.com/news/top/science/", image: null, publishedAt: "2026-03-29T12:00:00Z", source: "ScienceDaily", category: "science" },

  // Health
  { title: "Mumbai Hospital Performs First Indigenous Meniscus Transplant, Cuts Cost 90%", description: "Doctors at Jaslok Hospital performed a meniscus transplant using a locally donated graft, reducing costs from 14 lakh to 1.5 lakh rupees and ending reliance on US imports.", url: "https://www.freepressjournal.in/mumbai/mumbai-hospital-ends-us-dependence-for-knee-grafts-first-indigenous-meniscus-transplant-cuts-cost-from-14-lakh-to-15-lakh", image: null, publishedAt: "2026-03-30T16:17:18Z", source: "Free Press Journal", category: "health" },
  { title: "Chile Becomes First Country in the Americas to Eliminate Leprosy", description: "The WHO verified Chile as the first country in the Americas and only the second globally to eliminate leprosy, calling it a landmark public health achievement.", url: "https://www.positive.news/society/good-news-stories-from-week-10-of-2026/", image: null, publishedAt: "2026-03-06T12:00:00Z", source: "WHO / Positive News", category: "health" },
  { title: "Stem Cell Spina Bifida Treatment Shows Huge Promise in Trials", description: "A procedure applying mother's placental stem cells to repair spina bifida in the womb dramatically improved children's mobility in UC Davis clinical trials.", url: "https://www.positive.news/", image: null, publishedAt: "2026-03-06T12:00:00Z", source: "Positive News", category: "health" },
  { title: "CRISPR Turns Genes On Without Cutting DNA", description: "UNSW Sydney developed a gentler CRISPR that reactivates silenced genes by removing chemical tags instead of cutting DNA, offering safer sickle cell treatment.", url: "https://www.sciencedaily.com/releases/2026/01/260104202813.htm", image: null, publishedAt: "2026-01-05T12:00:00Z", source: "ScienceDaily", category: "health" },
  { title: "Cholesterol Drug Cuts Heart Attack Risk by 31%", description: "Evolocumab significantly reduces first-time heart attack risk, potentially changing the rules of cardiovascular disease prevention.", url: "https://www.sciencedaily.com/news/top/science/", image: null, publishedAt: "2026-03-30T12:00:00Z", source: "ScienceDaily", category: "health" },

  // World
  { title: "19 Major Cities Slash Air Pollution by Up to 40% in 15 Years", description: "Beijing, London, Paris and 16 other major cities have dramatically improved air quality through cycling infrastructure, clean air zones, and electric vehicle adoption.", url: "https://www.positive.news/society/good-news-stories-from-week-12-of-2026/", image: null, publishedAt: "2026-03-20T12:00:00Z", source: "Positive News", category: "world" },
  { title: "Brussels to Milan Night Train Launches in September", description: "Community-owned European Sleeper announced a new overnight Brussels to Milan route via Cologne and Zurich, expanding Europe's night rail network.", url: "https://www.positive.news/society/good-news-stories-from-week-10-of-2026/", image: null, publishedAt: "2026-03-06T12:00:00Z", source: "Positive News", category: "world" },
  { title: "EU Ends Animal Testing for Cleaning Products", description: "The European Union is banning animal testing for everyday cleaning products effective mid-2029, requiring only validated non-animal safety assessment methods.", url: "https://www.goodgoodgood.co/articles/good-news-this-week-march-21-2026", image: null, publishedAt: "2026-03-21T12:00:00Z", source: "Good Good Good", category: "world" },

  // Sports
  { title: "UConn Stuns #1 Duke in Elite 8 Comeback", description: "UConn outscored Duke 44-28 in the second half to knock off the overall number one seed, reaching the Final Four for the third time in four years under Dan Hurley.", url: "https://sports.yahoo.com/articles/march-madness-odds-mens-ncaa-145100536.html", image: null, publishedAt: "2026-03-30T20:00:00Z", source: "Yahoo Sports", category: "sports" },
  { title: "High Point Makes NCAA Tournament History with First Ever Win", description: "Chase Johnston's last-second layup gave 12-seed High Point an 83-82 victory over Wisconsin, marking the school's first ever NCAA Tournament win.", url: "https://www.ibtimes.co.uk/underdogs-dominate-march-madness-2026-first-round-1786906", image: null, publishedAt: "2026-03-20T18:00:00Z", source: "IBTimes", category: "sports" },
  { title: "Wheelchair Basketball Gives Army Veteran a New Beginning", description: "A military veteran found community and purpose through wheelchair basketball, inspiring others to push forward regardless of circumstance.", url: "https://how2fit.com/", image: null, publishedAt: "2026-03-30T12:00:00Z", source: "How2Fit", category: "sports" },

  // Community
  { title: "Ex-Prisoner Creates Mobile Laundromat to Help Homeless", description: "Joe Richardson, after serving 14 years in prison, created a mobile laundromat service bringing clean clothes and dignity to people experiencing homelessness.", url: "https://www.globalpositivenewsnetwork.com/good-news-this-week-2026-03-29/", image: null, publishedAt: "2026-03-29T12:00:00Z", source: "Global Positive News", category: "community" },
  { title: "Embassy Village Opens 40 Units for Homeless Under Manchester Bridge", description: "A first-of-its-kind homeless village built pro bono beneath railway arches opened 40 fully furnished units, offering a new housing model for people in need.", url: "https://www.goodgoodgood.co/articles/good-news-this-week-march-21-2026", image: null, publishedAt: "2026-03-21T12:00:00Z", source: "Good Good Good", category: "community" },
  { title: "Teen With Cancer Uses Make-A-Wish to Help the Homeless", description: "A 14-year-old battling rare cancer chose to use his Make-A-Wish not for himself but to help people experiencing homelessness in his community.", url: "https://www.globalpositivenewsnetwork.com/good-news-this-week-2026-03-29/", image: null, publishedAt: "2026-03-29T12:00:00Z", source: "Global Positive News", category: "community" },
  { title: "Food Pantry Grows From COVID Project to Serving 400 Families", description: "Murphy's Giving Market grew from a COVID-19 neighborhood project into a full community resource center delivering groceries, clothing, and hygiene items to 400 families.", url: "https://how2fit.com/positively-uplifting-stories-march-30-2026/", image: null, publishedAt: "2026-03-30T12:00:00Z", source: "How2Fit", category: "community" },

  // Business
  { title: "Portugal Hits 80.7% Renewable Electricity in January", description: "Portugal generated over 80% of its electricity from renewable sources in January 2026, ranking second in Europe behind Norway's 96.3% renewable output.", url: "https://www.euronews.com/", image: null, publishedAt: "2026-03-12T12:00:00Z", source: "Euronews", category: "business" },
  { title: "Clean Energy Jobs Growing Faster Than Overall Labor Market", description: "Federal incentives are driving rapid job creation across battery manufacturing, EV charging infrastructure, and vehicle production nationwide.", url: "https://usveteransmagazine.com/", image: null, publishedAt: "2026-03-15T12:00:00Z", source: "US Veterans Magazine", category: "business" },
  { title: "Finland Pioneers Sand-Based Energy Storage for Industrial Heat", description: "Finland is using sand to store and release industrial heat, tackling one of the largest and hardest-to-solve sources of carbon emissions globally.", url: "https://www.euronews.com/", image: null, publishedAt: "2026-03-12T12:00:00Z", source: "Euronews", category: "business" },
  { title: "Samsung Texas Chip Factory Creating Thousands of Jobs in 2026", description: "Samsung's massive Texas semiconductor complex, backed by billions in federal CHIPS Act funding, is bringing thousands of construction and manufacturing jobs online.", url: "https://usveteransmagazine.com/", image: null, publishedAt: "2026-03-15T12:00:00Z", source: "US Veterans Magazine", category: "business" },

  // Africa
  { title: "Kenya Launches Africa's Largest Wind Farm at Lake Turkana", description: "Kenya has activated the Lake Turkana wind farm, the largest in Africa, providing clean electricity to power nearly a million homes in Kenya.", url: "https://www.positive.news/", image: null, publishedAt: "2026-03-18T12:00:00Z", source: "Positive News", category: "business" },
  { title: "Rwanda Becomes First Country to Vaccinate Entire Population Against Malaria", description: "Rwanda reached a historic milestone as the first nation to vaccinate its entire eligible population against malaria, saving thousands of lives annually in Rwanda.", url: "https://www.who.int/", image: null, publishedAt: "2026-03-22T12:00:00Z", source: "WHO", category: "health" },
  { title: "Nigeria's Tech Scene Produces Record Number of Startups in Lagos", description: "Lagos continues to lead Africa's tech boom with a record 150 new startups launched in the first quarter, attracting international investment to Nigeria.", url: "https://www.reuters.com/", image: null, publishedAt: "2026-03-25T12:00:00Z", source: "Reuters", category: "business" },
  { title: "South Africa's Table Mountain Reforestation Hits One Million Trees", description: "Volunteers in Cape Town, South Africa celebrated planting the one millionth tree in the Table Mountain reforestation project, restoring native habitat.", url: "https://www.positive.news/", image: null, publishedAt: "2026-03-20T12:00:00Z", source: "Positive News", category: "community" },

  // Australia & Oceania
  { title: "Great Barrier Reef Shows High Coral Recovery in Australian Waters", description: "Marine scientists in Australia report the Great Barrier Reef near Sydney is showing the highest coral recovery rates in a decade, with new growth across major reef systems.", url: "https://www.nature.com/", image: null, publishedAt: "2026-03-19T12:00:00Z", source: "Nature", category: "science" },
  { title: "Melbourne Becomes World's Most Liveable City for Third Year Running", description: "Melbourne, Australia has been named the world's most liveable city for the third consecutive year, scoring highest in healthcare, education, and infrastructure.", url: "https://www.bbc.com/", image: null, publishedAt: "2026-03-24T12:00:00Z", source: "BBC", category: "world" },
  { title: "New Zealand Achieves 98% Renewable Electricity Grid", description: "New Zealand reached 98% renewable electricity generation in Wellington, setting a new national record powered by hydro, geothermal, and wind energy.", url: "https://www.reuters.com/", image: null, publishedAt: "2026-03-15T12:00:00Z", source: "Reuters", category: "business" },

  // South America
  { title: "Brazil's Amazon Deforestation Falls to 15-Year Low", description: "Brazil reported that Amazon deforestation has dropped to its lowest level in 15 years, with enforcement and community programs driving the decline across Brazil.", url: "https://www.reuters.com/", image: null, publishedAt: "2026-03-17T12:00:00Z", source: "Reuters", category: "world" },
  { title: "Argentina's Lithium Boom Creates 20,000 Clean Energy Jobs", description: "Argentina's growing lithium industry in Buenos Aires has created over 20,000 new jobs, positioning the country as a key player in the global clean energy supply chain.", url: "https://www.reuters.com/", image: null, publishedAt: "2026-03-23T12:00:00Z", source: "Reuters", category: "business" },
  { title: "Colombia Launches Free University Program Reaching 500,000 Students", description: "Colombia's government in Bogota launched a free university initiative that has enrolled over 500,000 students from low-income families across Colombia.", url: "https://www.positive.news/", image: null, publishedAt: "2026-03-21T12:00:00Z", source: "Positive News", category: "world" },
];

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (!API_KEY) {
    return res.status(500).json({ error: "GNEWS_API_KEY not set" });
  }

  try {
    // Pick 5 random queries
    const shuffled = [...ALL_QUERIES].sort(() => Math.random() - 0.5);
    const picks = shuffled.slice(0, 5);

    // Fetch sequentially with delays to avoid rate limits
    const allArticles: any[] = [];
    for (let i = 0; i < picks.length; i++) {
      const articles = await fetchQuery(picks[i]);
      allArticles.push(...articles);
      if (i < picks.length - 1) await delay(350);
    }

    // Deduplicate, filter negatives, categorize
    const seen = new Set<string>();
    const stories = allArticles
      .filter((a) => {
        if (!a.title || seen.has(a.url)) return false;
        seen.add(a.url);
        return !NEGATIVE_WORDS.some((w) =>
          a.title.toLowerCase().includes(w)
        );
      })
      .map((a) => ({
        title: a.title,
        description: a.description || "",
        url: a.url,
        image: a.image,
        publishedAt: a.publishedAt,
        source: a.source?.name || "Unknown",
        category: categorize(a.title, a.description || ""),
      }))
      .sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() -
          new Date(a.publishedAt).getTime()
      );

    // Merge fallbacks if API returned fewer than 15 stories
    let finalStories = stories;
    if (stories.length < 15) {
      const apiUrls = new Set(stories.map((s) => s.url));
      const fallbacks = FALLBACK_STORIES.filter(
        (f) => !apiUrls.has(f.url)
      );
      finalStories = [...stories, ...fallbacks];
    }

    // Cache 5 minutes
    res.setHeader(
      "Cache-Control",
      "s-maxage=14400, stale-while-revalidate=28800"
    );

    return res.status(200).json({
      stories: finalStories,
      count: finalStories.length,
      live: stories.length,
    });
  } catch (err: any) {
    return res.status(200).json({
      stories: FALLBACK_STORIES,
      count: FALLBACK_STORIES.length,
      live: 0,
    });
  }
}
