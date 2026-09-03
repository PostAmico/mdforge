/**
 * Content Pre-processor — converts custom block tags into
 * standard markdown before passing to the markdown parser.
 *
 * Only converts data-presentable blocks that make sense in a document.
 * Interactive/UI-only blocks (social previews, forms, pickers, DMs) are stripped.
 */

import { coerceNumber } from "../chart-normalizer";

// ─── Status Icons ───────────────────────────────────────────────────────────

const STATUS_ICONS: Record<string, string> = {
  completed: "[x]",
  "in-progress": "[~]",
  active: "[~]",
  running: "[~]",
  queued: "[ ]",
  failed: "[!]",
  skipped: "[-]",
};

// ─── Main Export ────────────────────────────────────────────────────────────

export function preprocessContent(content: string): string {
  let result = content;

  // ── Data blocks → markdown tables/sections ──

  result = processWorkflowTimeline(result);
  result = processGoalTimeline(result);
  result = processMetricsGrid(result);
  result = processCampaignPerformance(result);
  result = processContentCalendar(result);
  result = processProgress(result);
  result = processLeadList(result);
  result = processRevenueAttribution(result);

  // ── Presentable blocks → simplified markdown ──

  // <card title="...">content</card> → blockquote with title
  result = result.replace(
    /<card[^>]*title="([^"]*)"[^>]*>([\s\S]*?)<\/card>/g,
    (_m, title: string, body: string) => `\n> **${title}**\n> ${body.trim()}\n`
  );

  // <inline_html> / <html_block> → strip HTML tags, keep text
  result = result.replace(
    /<(?:inline_html|html_block)[^>]*>([\s\S]*?)<\/(?:inline_html|html_block)>/g,
    (_m, body: string) => "\n" + stripHtml(body.trim()) + "\n"
  );

  // ── Interactive/UI-only blocks → remove entirely ──

  const stripBlocks = [
    "action_approval", "interaction", "schedule_picker", "form", "action",
    "instagram_preview", "facebook_preview", "linkedin_preview",
    "youtube_preview", "wordpress_preview", "meta_ad_preview",
    "google_search_ad_preview", "google_video_ad_preview",
    "lead_form_preview", "instagram_reel_preview", "instagram_story_preview",
    "dm_conversation", "comment_thread", "agent_status", "agent_completion",
    "workspace_export", "automation_rule", "product_card", "order_summary",
    "lead_card", "map", "video",
  ];

  for (const tag of stripBlocks) {
    const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, "g");
    result = result.replace(regex, "");
  }

  // Strip self-closing custom tags: <file .../>, <image .../>, etc.
  result = result.replace(/<(?:file|image|img|video)\s[^>]*\/>/g, "");

  return result;
}

// ─── Block Processors ───────────────────────────────────────────────────────

function processWorkflowTimeline(content: string): string {
  return content.replace(
    /<workflow_timeline([^>]*)>([\s\S]*?)<\/workflow_timeline>/g,
    (_m, attrs: string, body: string) => {
      const titleMatch = attrs.match(/title="([^"]*)"/);
      const title = titleMatch ? titleMatch[1] : "Workflow";
      const steps = parseJson(body.trim());
      if (!Array.isArray(steps) || steps.length === 0) return "";

      const completed = steps.filter((s: any) => s.status === "completed").length;
      let md = `\n### ${title}\n\n`;
      md += `*Progress: ${completed}/${steps.length} completed*\n\n`;
      md += `| Status | Step | Timeline | Details |\n`;
      md += `|:------:|------|----------|----------|\n`;

      for (const step of steps) {
        const icon = STATUS_ICONS[step.status] || "○";
        md += `| ${icon} | **${cell(step.label)}** | ${cell(step.timestamp)} | ${cell(step.description)} |\n`;
      }
      return md + "\n";
    }
  );
}

function processGoalTimeline(content: string): string {
  return content.replace(
    /<goal_timeline([^>]*)>([\s\S]*?)<\/goal_timeline>/g,
    (_m, attrs: string, body: string) => {
      const title = extractAttr(attrs, "title") || "Goal";
      const status = extractAttr(attrs, "status") || "in-progress";
      const progress = extractAttr(attrs, "progress") || "0";
      const tasks = parseJson(body.trim());
      if (!Array.isArray(tasks) || tasks.length === 0) return "";

      let md = `\n### ${title}\n\n`;
      md += `**Status:** ${status} · **Progress:** ${progress}%\n\n`;
      md += `| Status | Task | Agent |\n`;
      md += `|:------:|------|-------|\n`;

      for (const task of tasks) {
        const icon = STATUS_ICONS[task.status] || "○";
        md += `| ${icon} | ${cell(task.title)} | ${cell(task.agentType)} |\n`;
      }
      return md + "\n";
    }
  );
}

function processMetricsGrid(content: string): string {
  return content.replace(
    /<metrics_grid([^>]*)>([\s\S]*?)<\/metrics_grid>/g,
    (_m, attrs: string, body: string) => {
      const title = extractAttr(attrs, "title");
      const period = extractAttr(attrs, "period");
      const metrics = parseJson(body.trim());
      if (!Array.isArray(metrics) || metrics.length === 0) return "";

      let md = "";
      if (title) md += `\n### ${title}\n`;
      if (period) md += `*${period}*\n`;
      md += "\n| Metric | Value | Change |\n";
      md += "|--------|-------|--------|\n";

      for (const m of metrics) {
        const prefix = m.prefix || "";
        const suffix = m.suffix || "";
        const value = `${prefix}${m.value}${suffix}`;
        const change = m.change ? (m.positive ? `↑ ${m.change}` : `↓ ${m.change}`) : "—";
        md += `| ${cell(m.label)} | ${cell(value)} | ${cell(change)} |\n`;
      }
      return md + "\n";
    }
  );
}

function processCampaignPerformance(content: string): string {
  return content.replace(
    /<campaign_performance([^>]*)>([\s\S]*?)<\/campaign_performance>/g,
    (_m, attrs: string, _body: string) => {
      const name = extractAttr(attrs, "name") || "Campaign";
      const platform = extractAttr(attrs, "platform") || "";
      const status = extractAttr(attrs, "status") || "active";
      const spend = extractAttr(attrs, "spend") || "0";
      const budget = extractAttr(attrs, "budget") || "0";
      const roas = extractAttr(attrs, "roas");
      const cpa = extractAttr(attrs, "cpa");
      const impressions = extractAttr(attrs, "impressions");
      const clicks = extractAttr(attrs, "clicks");
      const currency = extractAttr(attrs, "currency") || "₹";

      let md = `\n### ${name}\n\n`;
      md += `**Platform:** ${platform.replace("_", " ")} · **Status:** ${status}\n\n`;
      md += `| Metric | Value |\n|--------|-------|\n`;
      md += `| Budget | ${currency}${formatNumber(budget)} |\n`;
      md += `| Spend | ${currency}${formatNumber(spend)} |\n`;
      if (impressions) md += `| Impressions | ${formatNumber(impressions)} |\n`;
      if (clicks) md += `| Clicks | ${formatNumber(clicks)} |\n`;
      if (roas) md += `| ROAS | ${cell(roas)}x |\n`;
      if (cpa) md += `| CPA | ${currency}${formatNumber(cpa)} |\n`;

      return md + "\n";
    }
  );
}

function processContentCalendar(content: string): string {
  return content.replace(
    /<content_calendar([^>]*)>([\s\S]*?)<\/content_calendar>/g,
    (_m, attrs: string, body: string) => {
      const title = extractAttr(attrs, "title") || "Content Calendar";
      const period = extractAttr(attrs, "period");
      const items = parseJson(body.trim());
      if (!Array.isArray(items) || items.length === 0) return "";

      let md = `\n### ${title}\n`;
      if (period) md += `*${period}*\n`;
      md += "\n| Date | Time | Title | Platform | Status |\n";
      md += "|------|------|-------|----------|--------|\n";

      for (const item of items) {
        md += `| ${cell(item.date)} | ${cell(item.time)} | ${cell(item.title)} | ${cell(item.platform)} | ${cell(item.status)} |\n`;
      }
      return md + "\n";
    }
  );
}

function processProgress(content: string): string {
  return content.replace(
    /<progress([^>]*)>([\s\S]*?)<\/progress>/g,
    (_m, attrs: string, body: string) => {
      const pct = parseInt(extractAttr(attrs, "percentage") || "0", 10);
      const label = extractAttr(attrs, "statusText") || extractAttr(attrs, "status") || (pct >= 100 ? "Completed" : "In Progress");
      const bar = renderTextProgressBar(pct);

      let md = `\n**${label}** ${bar} ${pct}%\n`;

      const steps = parseJson(body.trim());
      if (Array.isArray(steps) && steps.length > 0) {
        for (const step of steps) {
          const icon = step.done ? "✓" : "○";
          md += `- ${icon} ${step.label}\n`;
        }
      }
      return md + "\n";
    }
  );
}

function processLeadList(content: string): string {
  return content.replace(
    /<lead_list([^>]*)>([\s\S]*?)<\/lead_list>/g,
    (_m, attrs: string, body: string) => {
      const title = extractAttr(attrs, "title") || "Leads";
      const leads = parseJson(body.trim());
      if (!Array.isArray(leads) || leads.length === 0) return "";

      let md = `\n### ${title}\n\n`;
      md += `| Name | Email | Source | Status | Score |\n`;
      md += `|------|-------|--------|--------|-------|\n`;

      for (const lead of leads) {
        md += `| ${cell(lead.name)} | ${cell(lead.email)} | ${cell(lead.source)} | ${cell(lead.status)} | ${cell(lead.score)} |\n`;
      }
      return md + "\n";
    }
  );
}

function processRevenueAttribution(content: string): string {
  return content.replace(
    /<revenue_attribution([^>]*)>([\s\S]*?)<\/revenue_attribution>/g,
    (_m, attrs: string, body: string) => {
      const title = extractAttr(attrs, "title") || "Revenue Attribution";
      const totalRevenue = extractAttr(attrs, "totalRevenue");
      const totalSpend = extractAttr(attrs, "totalSpend");
      const totalRoas = extractAttr(attrs, "totalRoas");
      const currency = extractAttr(attrs, "currency") || "₹";
      const channels = parseJson(body.trim());

      let md = `\n### ${title}\n\n`;

      if (totalRevenue || totalSpend || totalRoas) {
        md += `**Total Revenue:** ${currency}${formatNumber(totalRevenue ?? 0)} · `;
        md += `**Total Spend:** ${currency}${formatNumber(totalSpend ?? 0)} · `;
        md += `**ROAS:** ${totalRoas || "—"}x\n\n`;
      }

      if (Array.isArray(channels) && channels.length > 0) {
        md += `| Channel | Revenue | Spend | ROAS |\n`;
        md += `|---------|---------|-------|------|\n`;
        for (const ch of channels) {
          md += `| ${cell(ch.channel)} | ${currency}${formatNumber(ch.revenue ?? 0)} | ${currency}${formatNumber(ch.spend ?? 0)} | ${cell(ch.roas || "—")}x |\n`;
        }
      }
      return md + "\n";
    }
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractAttr(attrs: string, name: string): string | undefined {
  // Anchor to a word boundary so `title` doesn't match `subtitle`, and escape
  // the name defensively in case it ever contains regex metacharacters.
  const safe = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = attrs.match(new RegExp(`\\b${safe}="([^"]*)"`));
  return match ? match[1] : undefined;
}

/**
 * Format a possibly-messy numeric value ("12,000", "1.2M", "$4500") with
 * thousands separators. Falls back to the raw string when it isn't numeric,
 * so we never print "NaN" into a table.
 */
function formatNumber(value: unknown): string {
  const n = coerceNumber(value);
  if (n === null) return value === undefined || value === null ? "" : String(value);
  return n.toLocaleString("en-US");
}

/**
 * Escape a value for safe use inside a single markdown table cell: pipes would
 * split the cell into extra columns and newlines would break the row.
 */
function cell(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function parseJson(str: string): any[] | null {
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function renderTextProgressBar(pct: number): string {
  const filled = Math.round(pct / 10);
  const empty = 10 - filled;
  return `[${"=".repeat(filled)}${".".repeat(empty)}]`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
