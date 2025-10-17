import { ENTRY_PATH, type SnapshotVariant } from "../compileScenarioShared";
import type { SnapshotDefinition } from "./types";
import { applyReplacements } from "./utils";

import indexTemplate from "./analytics/files/index.ts?raw";
import metricsTemplate from "./analytics/files/metrics.ts?raw";
import reportTemplate from "./analytics/files/report.ts?raw";
import stylesTemplate from "./analytics/files/styles.css?raw";
import forecastVendor from "./analytics/files/vendor/forecast.ts?raw";
import formatVendor from "./analytics/files/vendor/format.ts?raw";

type AnalyticsVariantConfig = {
  accent: string;
  announcement: string;
  badgePrefix: string;
  badgeFallback: string;
  window: number;
  dataset: Array<{
    region: string;
    latency: number[];
    errors: number[];
    throughput: number[];
  }>;
};

const ANALYTICS_VARIANTS: Record<SnapshotVariant, AnalyticsVariantConfig> = {
  fresh: {
    accent: "#1d4ed8",
    announcement: "Baseline ingestion metrics from active regions.",
    badgePrefix: "Ops baseline",
    badgeFallback: "Ops baseline (loading)",
    window: 3,
    dataset: [
      {
        region: "apac",
        latency: [320, 305, 288, 276, 265],
        errors: [16, 14, 12, 9, 8],
        throughput: [2800, 2950, 3100, 3275, 3450],
      },
      {
        region: "amer",
        latency: [290, 284, 279, 271, 265],
        errors: [12, 11, 10, 9, 8],
        throughput: [3400, 3520, 3650, 3780, 3925],
      },
      {
        region: "emea",
        latency: [305, 297, 289, 282, 276],
        errors: [10, 11, 9, 8, 7],
        throughput: [3000, 3120, 3240, 3365, 3500],
      },
    ],
  },
  updated: {
    accent: "#0f766e",
    announcement: "Rebalanced routing after cache warm-up completes.",
    badgePrefix: "Ops accelerated",
    badgeFallback: "Ops accelerated (loading)",
    window: 4,
    dataset: [
      {
        region: "apac",
        latency: [276, 268, 261, 255, 248, 241],
        errors: [8, 7, 7, 6, 5, 5],
        throughput: [3320, 3440, 3575, 3720, 3880, 4050],
      },
      {
        region: "amer",
        latency: [262, 256, 251, 245, 238, 232],
        errors: [8, 7, 6, 6, 5, 5],
        throughput: [3950, 4080, 4210, 4360, 4520, 4695],
      },
      {
        region: "emea",
        latency: [275, 268, 260, 254, 247, 241],
        errors: [7, 7, 6, 6, 5, 5],
        throughput: [3510, 3650, 3785, 3930, 4075, 4220],
      },
      {
        region: "latam",
        latency: [315, 304, 292, 283, 272, 263],
        errors: [14, 13, 11, 10, 9, 8],
        throughput: [2600, 2720, 2860, 3010, 3175, 3350],
      },
    ],
  },
};

export const analyticsSnapshot: SnapshotDefinition = {
  id: "analytics",
  label: "Analytics forecast",
  description: "Aggregates multi-region metrics and forecasts future latency using vendor utilities.",
  build: (variant) => {
    const config = ANALYTICS_VARIANTS[variant];

    const announcementLiteral = JSON.stringify(config.announcement);
    const badgePrefixLiteral = JSON.stringify(config.badgePrefix);
    const badgeFallbackLiteral = JSON.stringify(config.badgeFallback);
    const accentLiteral = config.accent;
    const datasetLiteral = JSON.stringify(config.dataset);

    return {
      entry: ENTRY_PATH,
      files: {
        "/index.ts": applyReplacements(indexTemplate, {
          __ANNOUNCEMENT__: announcementLiteral,
          __BADGE_FALLBACK__: badgeFallbackLiteral,
        }),
        "/metrics.ts": applyReplacements(metricsTemplate, {
          __DATA__: datasetLiteral,
        }),
        "/report.ts": applyReplacements(reportTemplate, {
          __WINDOW__: String(config.window),
          __BADGE_PREFIX__: badgePrefixLiteral,
        }),
        "/styles.css": applyReplacements(stylesTemplate, {
          __ACCENT__: accentLiteral,
        }),
        "/vendor/forecast.ts": forecastVendor,
        "/vendor/format.ts": formatVendor,
      },
    };
  },
};
