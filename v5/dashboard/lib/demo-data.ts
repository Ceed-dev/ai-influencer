/**
 * Demo data fallback for when DB has no real data.
 * Each API route imports the relevant demo object and returns it
 * when DB results are empty. Once real data exists, demo is never used.
 */

// ---------------------------------------------------------------------------
// KPI Summary (Home 4 cards + KPI page 10 cards)
// ---------------------------------------------------------------------------
export const DEMO_KPI_SUMMARY = {
  accounts: 42,
  followers: {
    current: 128500,
    target: 200000,
    growth_rate: 3.2,
  },
  engagement: {
    avg_rate: 4.85,
    trend: "growing" as const,
  },
  content: {
    total_produced: 156,
    total_posted: 89,
    total_measured: 67,
  },
  monetization: {
    monetized_count: 12,
    revenue_estimate: 2340,
  },
  prediction_accuracy: 0.78,
};

// ---------------------------------------------------------------------------
// Accounts (Home — Pie chart + Weekly growth chart)
// ---------------------------------------------------------------------------
function buildDemoAccounts() {
  const platforms: Array<{
    platform: string;
    count: number;
    prefix: string;
    usernames: string[];
  }> = [
    {
      platform: "youtube",
      count: 14,
      prefix: "YT",
      usernames: [
        "TechInsider", "DailyVlog", "CookWithAI", "GameMaster",
        "FitnessPro", "TravelNow", "MusicVibes", "SciExplain",
        "StyleGuru", "PetLovers", "DIYCraft", "BookClub",
        "NatureWild", "CodeTutors",
      ],
    },
    {
      platform: "tiktok",
      count: 12,
      prefix: "TK",
      usernames: [
        "DanceBot", "FoodieAI", "LifeHacks", "PrankKing",
        "BeautyTips", "FunFacts", "SketchArt", "WorkoutWin",
        "TrendAlert", "MemeFactory", "StudyGram", "PetTricks",
      ],
    },
    {
      platform: "instagram",
      count: 10,
      prefix: "IG",
      usernames: [
        "UrbanShots", "MinimalDesign", "FoodArtist", "WanderLens",
        "FashionAI", "FitJourney", "ArtDaily", "CafeHopper",
        "StreetStyle", "PlantMom",
      ],
    },
    {
      platform: "x",
      count: 6,
      prefix: "XP",
      usernames: [
        "AIUpdates", "CryptoWatch", "DevTips", "NewsFlash",
        "StartupBuzz", "TechDebate",
      ],
    },
  ];

  const accounts: Array<Record<string, unknown>> = [];
  let globalIdx = 1;

  // Spread created_at across 8 weeks (56 days)
  const now = new Date();

  for (const p of platforms) {
    for (let i = 0; i < p.count; i++) {
      const daysAgo = Math.floor((globalIdx / 42) * 56); // spread over 56 days
      const createdAt = new Date(now.getTime() - daysAgo * 86400000);
      const followerBase = p.platform === "youtube" ? 5000
        : p.platform === "tiktok" ? 3000
        : p.platform === "instagram" ? 4000
        : 1500;

      accounts.push({
        id: globalIdx,
        account_id: `ACC_${String(globalIdx).padStart(4, "0")}`,
        platform: p.platform,
        platform_username: `@${p.usernames[i]}`,
        character_id: `CHAR_${String(((globalIdx - 1) % 10) + 1).padStart(3, "0")}`,
        niche: ["tech", "lifestyle", "entertainment", "education", "food"][globalIdx % 5],
        cluster: `cluster_${String.fromCharCode(97 + (globalIdx % 5))}`,
        status: "active",
        follower_count: followerBase + Math.floor(Math.random() * followerBase),
        auth_credentials: null,
        created_at: createdAt.toISOString(),
        updated_at: createdAt.toISOString(),
      });
      globalIdx++;
    }
  }

  return accounts;
}

export const DEMO_ACCOUNTS = buildDemoAccounts();
export const DEMO_ACCOUNTS_TOTAL = DEMO_ACCOUNTS.length;

// ---------------------------------------------------------------------------
// Content (Home — Recent content table)
// ---------------------------------------------------------------------------
function buildDemoContent() {
  const statuses = [
    "posted", "posted", "posted", "posted",
    "measured", "measured", "measured",
    "pending_review", "pending_review",
    "approved", "approved",
    "producing", "producing",
    "planned", "planned",
    "ready",
    "pending_approval",
    "analyzed",
    "revision_needed",
    "cancelled",
  ];

  const formats = ["short_video", "short_video", "short_video", "text_post", "image_post"];

  const titles = [
    "5 AI Tools You Need in 2026",
    "Morning Routine Vlog #42",
    "Easy Pasta Recipe in 60s",
    "React Tips & Tricks",
    "Workout Challenge Day 7",
    "Tokyo Street Food Guide",
    "Lo-fi Beats Compilation",
    "How Quantum Computing Works",
    "Spring Fashion Haul",
    "Puppy Training 101",
    "DIY Home Office Setup",
    "Top 10 Books This Month",
    "National Park Adventure",
    "Python for Beginners",
    "Café Tour: Shibuya Edition",
    "Dance Tutorial: Latest Trend",
    "Healthy Meal Prep Ideas",
    "Startup Pitch Breakdown",
    "Street Photography Tips",
    "Indoor Plant Care Guide",
  ];

  const now = new Date();
  const content: Array<Record<string, unknown>> = [];

  for (let i = 0; i < 20; i++) {
    const daysAgo = i * 2; // spread over 40 days
    const createdAt = new Date(now.getTime() - daysAgo * 86400000);
    const qualityScore = 6.0 + Math.round(Math.random() * 35) / 10; // 6.0 ~ 9.5

    content.push({
      id: i + 1,
      content_id: `CNT_${String(i + 1).padStart(5, "0")}`,
      character_id: `CHAR_${String((i % 10) + 1).padStart(3, "0")}`,
      title: titles[i],
      status: statuses[i],
      content_format: formats[i % formats.length],
      quality_score: qualityScore,
      script: null,
      media_urls: null,
      created_at: createdAt.toISOString(),
      updated_at: createdAt.toISOString(),
    });
  }

  return content;
}

export const DEMO_CONTENT = buildDemoContent();
export const DEMO_CONTENT_TOTAL = DEMO_CONTENT.length;

// ---------------------------------------------------------------------------
// KPI Snapshots (KPI page — 3 charts)
// ---------------------------------------------------------------------------
function buildDemoSnapshots() {
  const platforms: Array<{
    platform: string;
    kpiTarget: number;
    baseImpressions: number;
  }> = [
    { platform: "youtube", kpiTarget: 15000, baseImpressions: 4000 },
    { platform: "tiktok", kpiTarget: 20000, baseImpressions: 5000 },
    { platform: "instagram", kpiTarget: 12000, baseImpressions: 3000 },
    { platform: "x", kpiTarget: 8000, baseImpressions: 2000 },
  ];

  const months = [
    "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02",
  ];

  const snapshots: Array<Record<string, unknown>> = [];
  let id = 1;

  for (const p of platforms) {
    for (let mi = 0; mi < months.length; mi++) {
      // Growth trend: impressions increase month over month
      const growthFactor = 1 + mi * 0.25; // 1.0 → 2.25
      const avgImpressions = Math.round(p.baseImpressions * growthFactor);
      const achievementRate = Math.min(
        0.95,
        0.4 + mi * 0.11 + (Math.random() * 0.05)
      );
      const predictionAccuracy = 0.65 + mi * 0.04 + (Math.random() * 0.02);

      snapshots.push({
        id,
        platform: p.platform,
        year_month: months[mi],
        kpi_target: p.kpiTarget,
        avg_impressions: avgImpressions,
        achievement_rate: Math.round(achievementRate * 1000) / 1000,
        account_count: 5 + mi * 2,
        publication_count: 10 + mi * 5,
        prediction_accuracy: Math.round(Math.min(0.85, predictionAccuracy) * 1000) / 1000,
        is_reliable: mi >= 2,
        calculated_at: new Date(`${months[mi]!}-28T00:00:00Z`).toISOString(),
      });
      id++;
    }
  }

  return snapshots;
}

export const DEMO_KPI_SNAPSHOTS = buildDemoSnapshots();
