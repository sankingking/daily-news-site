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

const FALLBACK_STORIES = [
  {
    module: "domestic",
    source: "演示数据",
    title: "宏观政策、民生服务与区域发展成为今日国内关注焦点",
    summary: "页面会优先抓取公开 RSS 源；网络或跨域受限时显示这组演示数据，方便保持版面可用。",
    link: "#",
    publishedAt: new Date().toISOString(),
    image: "",
  },
  {
    module: "domestic",
    source: "演示数据",
    title: "多地发布产业、交通与公共服务新动态",
    summary: "国内模块用于聚合来自中国新闻源的当天重点消息，并按发布时间排序。",
    link: "#",
    publishedAt: new Date(Date.now() - 36e5).toISOString(),
    image: "",
  },
  {
    module: "domestic",
    source: "演示数据",
    title: "城市更新、教育医疗与消费场景持续受到关注",
    summary: "搜索框会同时匹配标题、来源和摘要，便于快速筛选重点内容。",
    link: "#",
    publishedAt: new Date(Date.now() - 72e5).toISOString(),
    image: "",
  },
  {
    module: "world",
    source: "演示数据",
    title: "全球政治、经济与科技议题构成今日国际新闻主线",
    summary: "国外模块汇总国际新闻源，适合快速浏览世界范围内的重大事件。",
    link: "#",
    publishedAt: new Date(Date.now() - 18e5).toISOString(),
    image: "",
  },
  {
    module: "world",
    source: "演示数据",
    title: "多边组织、区域安全和市场波动继续牵动国际舆论",
    summary: "真实抓取成功后，演示数据会自动让位于当天新闻。",
    link: "#",
    publishedAt: new Date(Date.now() - 54e5).toISOString(),
    image: "",
  },
  {
    module: "world",
    source: "演示数据",
    title: "气候、能源与公共卫生议题在多国议程中升温",
    summary: "卡片会保留来源和发布时间，便于判断新闻时效。",
    link: "#",
    publishedAt: new Date(Date.now() - 96e5).toISOString(),
    image: "",
  },
];

const FETCH_TIMEOUT = 4000;

const DEFAULT_IMAGES = {
  domestic:
    "https://images.unsplash.com/photo-1522083165195-3424ed129620?auto=format&fit=crop&w=900&q=80",
  world:
    "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=900&q=80",
};

const CATEGORY_LABELS = {
  all: "全部",
  finance: "金融",
  tech: "科技",
  life: "生活",
  politics: "政治",
  society: "社会",
  culture: "文体",
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

const state = {
  stories: [],
  query: "",
  activeTab: "all",
  activeCategory: "all",
  isLoading: false,
};

const els = {
  todayLabel: document.querySelector("#todayLabel"),
  refreshBtn: document.querySelector("#refreshBtn"),
  searchInput: document.querySelector("#searchInput"),
  statusDot: document.querySelector("#statusDot"),
  statusText: document.querySelector("#statusText"),
  updatedAt: document.querySelector("#updatedAt"),
  leadLayout: document.querySelector("#leadLayout"),
  domesticList: document.querySelector("#domesticList"),
  worldList: document.querySelector("#worldList"),
  domesticCount: document.querySelector("#domesticCount"),
  worldCount: document.querySelector("#worldCount"),
  tabs: document.querySelectorAll(".tab"),
  categoryTabs: document.querySelectorAll(".category-chip"),
  modules: document.querySelectorAll("[data-module]"),
  template: document.querySelector("#storyTemplate"),
};

const formatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
});

els.todayLabel.textContent = formatter.format(new Date());

els.refreshBtn.addEventListener("click", () => loadNews({ manual: true }));
els.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value.trim().toLowerCase();
  render();
});

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    state.activeTab = tab.dataset.tab;
    els.tabs.forEach((item) => item.classList.toggle("is-active", item === tab));
    render();
  });
});

els.categoryTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    state.activeCategory = tab.dataset.category;
    els.categoryTabs.forEach((item) => item.classList.toggle("is-active", item === tab));
    render();
  });
});

loadNews({ reason: "initial" });

async function loadNews(options = {}) {
  if (state.isLoading) return;
  state.isLoading = true;
  setStatus("loading", "正在连接新闻源");
  els.refreshBtn.classList.add("is-loading");

  try {
    const { stories, source } = await fetchNews();

    const normalizedStories = normalizeAndSort(stories);
    const hasLiveStories = normalizedStories.length > 0;
    state.stories = hasLiveStories ? normalizedStories : normalizeAndSort(FALLBACK_STORIES);

    if (hasLiveStories) {
      const sourceLabel = source === "cloud" ? "云端接口" : "浏览器";
      setStatus("online", `${sourceLabel}已获取 ${normalizedStories.length} 条新闻`);
    } else {
      setStatus("offline", "暂未获取到带原文配图的新闻，可稍后点击刷新重试");
    }
  } catch (error) {
    state.stories = normalizeAndSort(FALLBACK_STORIES);
    setStatus("offline", "新闻源暂不可用，可稍后点击刷新重试");
  } finally {
    els.updatedAt.textContent = `更新于 ${formatClock(new Date())}`;
    els.refreshBtn.classList.remove("is-loading");
    state.isLoading = false;
    render();
  }
}

async function fetchNews() {
  const cloudStories = await fetchCloudNews();
  if (cloudStories.length) {
    return {
      source: "cloud",
      stories: cloudStories,
    };
  }

  return {
    source: "browser",
    stories: await fetchBrowserNews(),
  };
}

async function fetchCloudNews() {
  try {
    const response = await fetchWithTimeout(`/api/news?t=${Date.now()}`);
    if (!response.ok) return [];

    const payload = await response.json();
    return Array.isArray(payload.stories) ? payload.stories : [];
  } catch (error) {
    return [];
  }
}

async function fetchBrowserNews() {
  const results = await Promise.allSettled([
    fetchModule("domestic"),
    fetchModule("world"),
  ]);

  return results
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value)
    .filter(Boolean);
}

async function fetchModule(module) {
  const sourceResults = await Promise.allSettled(
    RSS_SOURCES[module].map((source) => fetchSource(source, module)),
  );

  return sourceResults
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value)
    .slice(0, 18);
}

async function fetchSource(source, module) {
  const xmlText = await fetchText(source.url);
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  const items = [...doc.querySelectorAll("item, entry")];

  return items.map((item) => {
    const link = getLink(item);

    return {
      module,
      source: source.name,
      title: getText(item, "title"),
      summary: cleanText(getText(item, "description, summary, content")),
      link,
      publishedAt: getText(item, "pubDate, published, updated") || new Date().toISOString(),
      image: getImage(item, link),
    };
  });
}

async function fetchText(url) {
  const candidates = [
    url,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  ];

  let lastError;
  for (const candidate of candidates) {
    try {
      const response = await fetchWithTimeout(candidate);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (text.includes("<rss") || text.includes("<feed") || text.includes("<item")) {
        return text;
      }
      throw new Error("不是有效 RSS 内容");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    return await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
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
      summary: cleanText(story.summary) || "暂无摘要",
      publishedAt: validDate(story.publishedAt),
      image: story.image || DEFAULT_IMAGES[story.module],
      category: story.category || inferCategory(story),
    }))
    .filter((story) => story.title && !seen.has(story.title) && seen.add(story.title))
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

function render() {
  const filtered = state.stories.filter((story) => {
    const inTab = state.activeTab === "all" || story.module === state.activeTab;
    const inCategory = state.activeCategory === "all" || story.category === state.activeCategory;
    const haystack = `${story.title} ${story.source} ${story.summary} ${getCategoryLabel(story.category)}`.toLowerCase();
    return inTab && inCategory && (!state.query || haystack.includes(state.query));
  });

  const domestic = filtered.filter((story) => story.module === "domestic").slice(0, 8);
  const world = filtered.filter((story) => story.module === "world").slice(0, 8);

  renderLeads(filtered);
  renderList(els.domesticList, domestic, "domestic");
  renderList(els.worldList, world, "world");

  els.domesticCount.textContent = `${domestic.length} 条`;
  els.worldCount.textContent = `${world.length} 条`;

  els.modules.forEach((module) => {
    const shouldHide = state.activeTab !== "all" && module.dataset.module !== state.activeTab;
    module.classList.toggle("is-hidden", shouldHide);
  });
}

function renderLeads(stories) {
  const leadStories = [
    stories.find((story) => story.module === "domestic"),
    stories.find((story) => story.module === "world"),
  ].filter(Boolean);

  els.leadLayout.innerHTML = "";

  leadStories.forEach((story, index) => {
    const card = document.createElement("a");
    card.className = `lead-card ${index ? "secondary" : ""}`;
    card.href = story.link || "#";
    card.target = "_blank";
    card.rel = "noreferrer";

    card.innerHTML = `
      <img src="${escapeAttribute(story.image)}" alt="" />
      <div class="lead-copy">
        <div>
          <span class="lead-badge ${story.module}">${story.module === "domestic" ? "国内头条" : "国外头条"}</span>
          <span class="lead-badge neutral">${getCategoryLabel(story.category)}</span>
          <h2>${escapeHTML(story.title)}</h2>
          <p>${escapeHTML(story.summary)}</p>
        </div>
        <div class="lead-source">
          <span>${escapeHTML(story.source)}</span>
          <span>${formatRelative(story.publishedAt)}</span>
        </div>
      </div>
    `;
    els.leadLayout.appendChild(card);
  });
}

function renderList(container, stories, module) {
  container.innerHTML = "";

  if (!stories.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = state.query ? "没有匹配的新闻。" : "暂无可显示新闻。";
    container.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  stories.forEach((story) => {
    const node = els.template.content.firstElementChild.cloneNode(true);
    node.href = story.link || "#";
    node.querySelector("img").src = story.image || DEFAULT_IMAGES[module];
    node.querySelector(".source").textContent = story.source;
    node.querySelector(".category").textContent = getCategoryLabel(story.category);
    node.querySelector(".time").textContent = formatRelative(story.publishedAt);
    node.querySelector("h3").textContent = story.title;
    node.querySelector("p").textContent = story.summary;
    fragment.appendChild(node);
  });
  container.appendChild(fragment);
}

function inferCategory(story) {
  const text = `${story.title || ""} ${story.summary || ""} ${story.source || ""}`;
  const lowerText = text.toLowerCase();

  const match = CATEGORY_RULES.find((rule) =>
    rule.keywords.some((keyword) => lowerText.includes(keyword.toLowerCase())),
  );

  return match?.id || "society";
}

function getCategoryLabel(category) {
  return CATEGORY_LABELS[category] || "社会";
}

function getText(item, selector) {
  const match = item.querySelector(selector);
  return match ? match.textContent.trim() : "";
}

function getLink(item) {
  const linkText = getText(item, "link");
  const linkHref = item.querySelector("link[href]")?.getAttribute("href");
  return linkHref || linkText || "#";
}

function getImage(item, articleUrl) {
  const candidates = [
    ...getMediaImages(item),
    ...getHtmlImages(getText(item, "description, summary, content")),
  ];

  return candidates
    .map((url) => normalizeImageUrl(url, articleUrl))
    .find((url) => isImageUrl(url)) || "";
}

function getMediaImages(item) {
  return [...item.querySelectorAll("enclosure[url], media\\:content[url], media\\:thumbnail[url], content[url], image url")]
    .map((node) => node.getAttribute("url") || node.textContent)
    .filter(Boolean);
}

function getHtmlImages(html) {
  return [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
    .map((match) => match[1])
    .filter(Boolean);
}

function normalizeImageUrl(url, articleUrl) {
  try {
    return new URL(url, articleUrl).href;
  } catch (error) {
    return "";
  }
}

function isImageUrl(url) {
  return /^https?:\/\//i.test(url) && !/(\.gif)(\?|$)/i.test(url);
}

function cleanText(value) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value || "";
  return textarea.value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function validDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function formatClock(date) {
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelative(value) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function setStatus(type, text) {
  els.statusDot.className = `status-dot ${type === "loading" ? "" : type}`;
  els.statusText.textContent = text;
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHTML(value).replaceAll("`", "&#096;");
}
