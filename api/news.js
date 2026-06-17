const RSS_SOURCES = {
  domestic: [
    {
      name: "中国新闻网",
      url: "https://www.chinanews.com.cn/rss/scroll-news.xml",
    },
    {
      name: "澎湃新闻",
      url: "https://rsshub.app/thepaper/featured",
    },
    {
      name: "央视新闻",
      url: "https://rsshub.app/cctv/china",
    },
  ],
  world: [
    {
      name: "BBC 中文",
      url: "https://feeds.bbci.co.uk/zhongwen/simp/rss.xml",
    },
    {
      name: "联合国新闻",
      url: "https://news.un.org/feed/subscribe/zh/news/all/rss.xml",
    },
    {
      name: "央视国际",
      url: "https://rsshub.app/cctv/world",
    },
  ],
};

const FETCH_TIMEOUT = 6500;
const MAX_ITEMS_PER_SOURCE = 10;
const MAX_STORIES_PER_MODULE = 12;

const DEFAULT_IMAGES = {
  domestic:
    "https://images.unsplash.com/photo-1522083165195-3424ed129620?auto=format&fit=crop&w=900&q=80",
  world:
    "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=900&q=80",
};

const CATEGORY_RULES = [
  {
    id: "finance",
    keywords: ["金融", "财经", "经济", "股", "证券", "基金", "银行", "央行", "汇率", "债券", "市场", "投资", "消费", "finance", "market", "stock", "bank"],
  },
  {
    id: "tech",
    keywords: ["科技", "人工智能", "AI", "芯片", "半导体", "互联网", "数据", "机器人", "航天", "手机", "电动", "新能源", "tech", "technology", "chip", "robot"],
  },
  {
    id: "life",
    keywords: ["生活", "健康", "医疗", "教育", "旅游", "天气", "住房", "交通", "美食", "养老", "就业", "消费", "health", "travel", "education"],
  },
  {
    id: "politics",
    keywords: ["政治", "政策", "政府", "外交", "会议", "总统", "总理", "选举", "国会", "议会", "部长", "policy", "election", "government"],
  },
  {
    id: "society",
    keywords: ["社会", "民生", "法治", "法院", "警方", "事故", "灾害", "救援", "安全", "案件", "公共", "crime", "court", "police"],
  },
  {
    id: "culture",
    keywords: ["文化", "体育", "电影", "音乐", "赛事", "比赛", "演出", "艺术", "博物馆", "文旅", "sports", "film", "music"],
  },
];

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  try {
    const [domestic, world] = await Promise.all([
      fetchModule("domestic"),
      fetchModule("world"),
    ]);

    const stories = normalizeAndSort([...domestic, ...world]);

    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");
    res.status(200).json({
      updatedAt: new Date().toISOString(),
      source: "vercel-api",
      stories,
    });
  } catch (error) {
    res.status(500).json({
      updatedAt: new Date().toISOString(),
      source: "vercel-api",
      stories: [],
      error: "NEWS_FETCH_FAILED",
    });
  }
};

async function fetchModule(module) {
  const results = await Promise.allSettled(
    RSS_SOURCES[module].map((source) => fetchSource(source, module)),
  );

  return results
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value)
    .slice(0, MAX_STORIES_PER_MODULE);
}

async function fetchSource(source, module) {
  const xml = await fetchText(source.url);
  const items = parseFeedItems(xml).slice(0, MAX_ITEMS_PER_SOURCE);
  const parsed = items.map((item) => parseFeedItem(item, source, module));

  return Promise.all(
    parsed.map(async (story) => ({
      ...story,
      image: story.image || (await fetchArticleImage(story.link)),
    })),
  );
}

function parseFeedItems(xml) {
  const items = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);
  const entries = [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((match) => match[0]);
  return [...items, ...entries];
}

function parseFeedItem(item, source, module) {
  const summaryHtml = getTag(item, ["description", "summary", "content:encoded", "content"]);
  const link = getLink(item);

  return {
    module,
    source: source.name,
    title: cleanText(getTag(item, ["title"])),
    summary: cleanText(summaryHtml) || "暂无摘要",
    link,
    publishedAt: getTag(item, ["pubDate", "published", "updated"]) || new Date().toISOString(),
    image: getItemImage(item, summaryHtml, link),
    category: "",
  };
}

function getTag(xml, names) {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = xml.match(new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i"));
    if (match) return decodeEntities(stripCdata(match[1]).trim());
  }
  return "";
}

function getLink(item) {
  const href = getAttribute(item, "link", "href");
  const text = getTag(item, ["link"]);
  return href || text || "#";
}

function getItemImage(item, html, articleUrl) {
  const candidates = [
    ...getTagImageAttributes(item),
    ...getHtmlImages(html),
  ];

  return pickImage(candidates, articleUrl);
}

function getTagImageAttributes(xml) {
  const matches = [
    ...xml.matchAll(/<(?:media:content|media:thumbnail|enclosure|content)\b[^>]*(?:url|href)=["']([^"']+)["'][^>]*>/gi),
  ];

  return matches.map((match) => match[1]);
}

async function fetchArticleImage(articleUrl) {
  if (!/^https?:\/\//i.test(articleUrl)) return "";

  try {
    const html = await fetchText(articleUrl);
    const candidates = [
      ...getMetaImages(html),
      ...getHtmlImages(html),
    ];
    return pickImage(candidates, articleUrl);
  } catch (error) {
    return "";
  }
}

function getMetaImages(html) {
  const candidates = [];
  const metaPattern = /<meta\b[^>]*(?:property|name)=["'](?:og:image|twitter:image|twitter:image:src)["'][^>]*content=["']([^"']+)["'][^>]*>/gi;
  const reversedMetaPattern = /<meta\b[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image|twitter:image:src)["'][^>]*>/gi;
  const linkPattern = /<link\b[^>]*rel=["']image_src["'][^>]*href=["']([^"']+)["'][^>]*>/gi;

  for (const match of html.matchAll(metaPattern)) candidates.push(match[1]);
  for (const match of html.matchAll(reversedMetaPattern)) candidates.push(match[1]);
  for (const match of html.matchAll(linkPattern)) candidates.push(match[1]);

  return candidates;
}

function getHtmlImages(html) {
  return [...html.matchAll(/<img\b[^>]+src=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
}

function getAttribute(xml, tag, attribute) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = xml.match(new RegExp(`<${escaped}\\b[^>]*${attribute}=["']([^"']+)["'][^>]*>`, "i"));
  return match ? decodeEntities(match[1]) : "";
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 NewsBoard/1.0",
        Accept: "text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeAndSort(stories) {
  const seen = new Set();

  return stories
    .map((story) => ({
      ...story,
      title: cleanText(story.title),
      summary: cleanText(story.summary),
      publishedAt: validDate(story.publishedAt),
      image: story.image || DEFAULT_IMAGES[story.module],
      category: story.category || inferCategory(story),
    }))
    .filter((story) => {
      const key = story.title || story.link;
      if (!story.title || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

function inferCategory(story) {
  const text = `${story.title || ""} ${story.summary || ""} ${story.source || ""}`;
  const lowerText = text.toLowerCase();

  const match = CATEGORY_RULES.find((rule) =>
    rule.keywords.some((keyword) => lowerText.includes(keyword.toLowerCase())),
  );

  return match?.id || "society";
}

function pickImage(candidates, baseUrl) {
  return candidates
    .map((url) => normalizeUrl(decodeEntities(url), baseUrl))
    .find((url) => isUsableImage(url)) || "";
}

function normalizeUrl(url, baseUrl) {
  try {
    return new URL(url, baseUrl).href;
  } catch (error) {
    return "";
  }
}

function isUsableImage(url) {
  return /^https?:\/\//i.test(url)
    && !/(\.gif|\.svg)(\?|$)/i.test(url)
    && !/(logo|avatar|icon|sprite|placeholder|default)/i.test(url);
}

function stripCdata(value) {
  return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function cleanText(value) {
  return decodeEntities(String(value || ""))
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function validDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}
