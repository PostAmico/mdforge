"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Download,
  Gear as Settings,
  Spinner as Loader2,
  UploadSimple,
  Moon,
  Sun,
  GithubLogo,
  Package,
  CaretDown,
  CaretUp,
  FilePdf,
  FileDoc,
  Lightning,
  ChartBar,
} from "@phosphor-icons/react";
import { useDropzone } from "react-dropzone";

import { resolveType } from "@/lib/chart-normalizer";
import { ChartBlockRenderer } from "@/components/renderers/ChartRenderer";
import { WorkflowTimelineRenderer } from "@/components/renderers/WorkflowTimelineRenderer";
import { GoalTimelineRenderer } from "@/components/renderers/GoalTimelineRenderer";
import { MetricsGridRenderer } from "@/components/renderers/MetricsGridRenderer";
import { CampaignPerformanceRenderer } from "@/components/renderers/CampaignPerformanceRenderer";
import { ContentCalendarRenderer } from "@/components/renderers/ContentCalendarRenderer";
import { ProgressRenderer } from "@/components/renderers/ProgressRenderer";
import { LeadListRenderer } from "@/components/renderers/LeadListRenderer";
import { RevenueAttributionRenderer } from "@/components/renderers/RevenueAttributionRenderer";
import { CardBlockRenderer } from "@/components/renderers/CardBlockRenderer";

const DEFAULT_MD = `# Chart & Document Export — Live Demo

Everything you see on the right renders with the **same engine** used for the PDF and DOCX download. What you preview is what you export.

Edit the markdown on the left, or drag & drop your own \`.md\` file, then hit **PDF** or **DOCX** in the top bar.

<card title="How charts work">
Put a JSON object inside a \`json-chart\` code block. A normalizer reads it, figures out the type, data, and labels for you, and draws it. You can be loose with the shape — it is built to accept the messy JSON that LLMs produce.
</card>

---

## 1. Quick Start

The minimum you need is a \`type\` and some \`data\`. Everything else is inferred.

\`\`\`json-chart
{
  "type": "bar",
  "title": "Export Formats Used This Month",
  "data": [
    { "name": "PDF", "value": 1240 },
    { "name": "DOCX", "value": 860 },
    { "name": "Markdown", "value": 410 }
  ]
}
\`\`\`

That is it. No \`index\`, no \`keys\` — the normalizer saw one text field (\`name\`) and one number field (\`value\`) and wired them up.

---

## 2. The Schema

A chart block is a JSON object. These are the fields you will use most:

| Field | Required | What it does |
| :--- | :---: | :--- |
| \`type\` | yes | Chart type. Aliases work: \`donut\`, \`column\`, \`spider\`. |
| \`data\` | usually | Array of rows, e.g. \`[{ "name": "A", "value": 5 }]\`. |
| \`title\` | no | Heading shown above the chart. |
| \`index\` | no | Which field is the label/x-axis. Inferred if omitted. |
| \`keys\` | no | Which field(s) are the numeric series. Inferred if omitted. |
| \`colors\` | no | Custom palette, e.g. \`["#8A2BE2", "#4169E1"]\`. |

**Forgiving by design.** Numbers can be written as \`"$1,200"\`, \`"45%"\`, or \`"1.2M"\` and still parse. Type names are case- and space-insensitive.

---

## 3. Core Chart Types

### Line — trends over time

\`\`\`json-chart
{
  "type": "line",
  "title": "User Growth (Q1)",
  "index": "month",
  "data": [
    { "month": "Jan", "users": 1200 },
    { "month": "Feb", "users": 1850 },
    { "month": "Mar", "users": 3100 }
  ]
}
\`\`\`

### Area — trends with volume

\`\`\`json-chart
{
  "type": "area",
  "title": "Weekly Active Users",
  "index": "day",
  "colors": ["#2E8B57"],
  "data": [
    { "day": "Mon", "active": 120 },
    { "day": "Tue", "active": 180 },
    { "day": "Wed", "active": 250 },
    { "day": "Thu", "active": 210 },
    { "day": "Fri", "active": 350 }
  ]
}
\`\`\`

### Pie & Doughnut — parts of a whole

\`\`\`json-chart
{
  "type": "pie",
  "title": "Traffic by Source",
  "data": [
    { "name": "Organic", "value": 52 },
    { "name": "Paid", "value": 28 },
    { "name": "Referral", "value": 20 }
  ]
}
\`\`\`

\`\`\`json-chart
{
  "type": "donut",
  "title": "Budget Allocation (alias: donut -> doughnut)",
  "data": [
    { "name": "Ads", "value": 45 },
    { "name": "Content", "value": 30 },
    { "name": "Tools", "value": 25 }
  ]
}
\`\`\`

---

## 4. Multi-Series & Grouped Data

Add more numeric fields per row and every one becomes its own series automatically.

\`\`\`json-chart
{
  "type": "bar",
  "title": "Revenue vs Spend by Channel",
  "index": "channel",
  "data": [
    { "channel": "Search", "revenue": 52000, "spend": 15000 },
    { "channel": "Social", "revenue": 48000, "spend": 18000 },
    { "channel": "Email", "revenue": 24500, "spend": 6000 }
  ]
}
\`\`\`

Want them stacked instead of side by side? Add \`"stacked": true\`.

---

## 5. Business & Marketing Charts

### Funnel — conversion stages

\`\`\`json-chart
{
  "type": "funnel",
  "title": "Signup Funnel",
  "data": [
    { "name": "Visited", "value": 10000 },
    { "name": "Signed Up", "value": 3200 },
    { "name": "Activated", "value": 1400 },
    { "name": "Paid", "value": 480 }
  ]
}
\`\`\`

### Gauge — a single KPI

\`\`\`json-chart
{
  "type": "gauge",
  "title": "Goal Completion",
  "value": 72,
  "min": 0,
  "max": 100
}
\`\`\`

### Waterfall — how a total is built up

\`\`\`json-chart
{
  "type": "waterfall",
  "title": "Monthly Profit Bridge",
  "data": [
    { "name": "Start", "value": 20000, "type": "total" },
    { "name": "New Sales", "value": 14000 },
    { "name": "Refunds", "value": -3000 },
    { "name": "Costs", "value": -8000 },
    { "name": "End", "value": 23000, "type": "total" }
  ]
}
\`\`\`

### Radar — compare across dimensions

\`\`\`json-chart
{
  "type": "radar",
  "title": "Product Scorecard",
  "index": "trait",
  "data": [
    { "trait": "Speed", "score": 8 },
    { "trait": "Design", "score": 9 },
    { "trait": "Price", "score": 6 },
    { "trait": "Support", "score": 7 },
    { "trait": "Docs", "score": 5 }
  ]
}
\`\`\`

---

## 6. Advanced Charts

### Scatter — correlation between two numbers

\`\`\`json-chart
{
  "type": "scatter",
  "title": "Ad Spend vs Conversions",
  "data": [
    { "x": 200, "y": 12 },
    { "x": 450, "y": 20 },
    { "x": 700, "y": 41 },
    { "x": 900, "y": 38 },
    { "x": 1200, "y": 63 }
  ]
}
\`\`\`

### Heatmap — density across a grid

\`\`\`json-chart
{
  "type": "heatmap",
  "title": "Engagement by Day & Hour",
  "data": [
    { "x": "Mon", "y": "AM", "value": 20 },
    { "x": "Mon", "y": "PM", "value": 60 },
    { "x": "Tue", "y": "AM", "value": 35 },
    { "x": "Tue", "y": "PM", "value": 80 }
  ]
}
\`\`\`

### Sankey — flow between stages

\`\`\`json-chart
{
  "type": "sankey",
  "title": "Lead Flow",
  "links": [
    { "source": "Ads", "target": "Landing", "value": 500 },
    { "source": "Landing", "target": "Signup", "value": 220 },
    { "source": "Signup", "target": "Paid", "value": 60 }
  ]
}
\`\`\`

---

## 7. It Handles Messy Input

You do not have to be tidy. This block uses a type alias (\`column chart\`), stringy numbers with currency and commas, and no \`index\`/\`keys\` at all — it still renders correctly.

\`\`\`json-chart
{
  "type": "column chart",
  "title": "Quarterly Revenue (messy input)",
  "data": [
    { "quarter": "Q1", "revenue": "$1,200,000" },
    { "quarter": "Q2", "revenue": "$1.8M" },
    { "quarter": "Q3", "revenue": "2100000" },
    { "quarter": "Q4", "revenue": "$2.4M" }
  ]
}
\`\`\`

---

## 8. Standard Markdown Works Too

Full GitHub Flavored Markdown renders alongside charts.

| Feature | PDF | DOCX | Preview |
| :--- | :---: | :---: | :---: |
| **Charts** | ✅ | ✅ | ✅ |
| **Tables** | ✅ | ✅ | ✅ |
| **Custom blocks** | ✅ | ✅ | ✅ |

You can use **bold**, *italic*, and ~~strikethrough~~ text.

1. Ordered lists
2. Nested items
   * with sub-bullets

- [x] Task done
- [ ] Task pending

> Turn unstructured AI output into board-ready reports in one step.

---

Ready? Edit any block above, tweak the JSON, or drag in your own \`.md\` file — then export to **PDF** or **DOCX**.
`;

interface Block {
  id: string;
  type: string;
  content?: string;
  props?: any;
  data?: string;
}

/**
 * Whether a plain ```json block should be rendered as a chart. Mirrors the
 * export pipeline: a chart-specific field (chartType/_chartVariant) is enough,
 * otherwise `type` must resolve to a real chart type and there must be some
 * data/links/series/value to plot. Keeps ordinary JSON documentation as code.
 */
function looksLikeChart(json: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return false;
  }
  if (typeof parsed !== 'object' || parsed === null) return false;
  const o = parsed as Record<string, unknown>;
  if ('chartType' in o || '_chartVariant' in o) return true;
  if ('type' in o && resolveType(o.type).type !== null) {
    return 'data' in o || 'links' in o || 'series' in o || 'value' in o;
  }
  return false;
}

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let remaining = text;

  // Regex to match custom tags: <tag_name attr="val">...</tag_name>
  const tagRegex = /<(workflow_timeline|goal_timeline|metrics_grid|campaign_performance|content_calendar|progress|lead_list|revenue_attribution|card)([^>]*)>([\s\S]*?)<\/\1>/;

  // Chart code blocks. `json-chart`/`chart` fences are always charts; a plain
  // `json` fence is only treated as a chart when its content looks like one
  // (see `looksLikeChart`). Capture group 1 = language tag, group 2 = body.
  // This mirrors the export pipeline (src/lib/export/extract-charts.ts) so the
  // preview and the downloaded document agree on what is a chart.
  const codeChartRegex = /```(json-chart|chart|json)[ \t]*\r?\n([\s\S]*?)```/;

  let idCounter = 0;
  const getId = () => `block-${idCounter++}`;

  while (remaining) {
    const tagMatch = tagRegex.exec(remaining);
    const chartMatch = codeChartRegex.exec(remaining);

    let match = null;
    let matchType = '';

    if (tagMatch && chartMatch) {
      if (tagMatch.index < chartMatch.index) { match = tagMatch; matchType = 'tag'; }
      else { match = chartMatch; matchType = 'chart'; }
    } else if (tagMatch) { match = tagMatch; matchType = 'tag'; }
    else if (chartMatch) { match = chartMatch; matchType = 'chart'; }

    if (!match) {
      if (remaining.trim()) {
        blocks.push({ id: getId(), type: 'markdown', content: remaining });
      }
      break;
    }

    if (match.index > 0) {
      const beforeContent = remaining.slice(0, match.index);
      if (beforeContent.trim()) {
        blocks.push({ id: getId(), type: 'markdown', content: beforeContent });
      }
    }

    if (matchType === 'tag') {
      const tagName = match[1];
      const attrsStr = match[2];
      const innerContent = match[3];

      const props: any = {};
      const attrRegex = /(\w+)="([^"]*)"/g;
      let attrMatch;
      while ((attrMatch = attrRegex.exec(attrsStr)) !== null) {
        props[attrMatch[1]] = attrMatch[2];
      }

      blocks.push({ id: getId(), type: tagName, props, data: innerContent.trim() });
    } else if (matchType === 'chart') {
      const lang = match[1];
      const innerContent = (match[2] || '').trim();

      // Dedicated chart fences are always charts. A plain ```json fence is only
      // a chart when its content actually looks like one — otherwise keep it as
      // a normal code block so real JSON documentation isn't hijacked.
      const isChart = lang !== 'json' || looksLikeChart(innerContent);

      if (isChart) {
        blocks.push({ id: getId(), type: 'chart', data: innerContent });
      } else {
        // Re-emit the whole fenced block as markdown so it renders as code.
        blocks.push({ id: getId(), type: 'markdown', content: match[0] });
      }
    }

    remaining = remaining.slice(match.index + match[0].length);
  }

  return blocks;
}

const LINKS = {
  github: "https://github.com/PostAmico/mdforge",
  npm: "https://www.npmjs.com/package/@postamico/mdforge",
  issues: "https://github.com/PostAmico/mdforge/issues",
  postamico: "https://github.com/PostAmico",
};

/** A short, labeled row used in the About section. */
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-1 sm:gap-6 py-4 border-t border-[var(--border-subtle)]">
      <div className="font-body text-[13px] text-[var(--ink-40)] pt-0.5">{label}</div>
      <div className="font-body text-[14px] text-[var(--ink-80)] leading-relaxed">{children}</div>
    </div>
  );
}

/** A single install command row. */
function InstallRow({ label, command }: { label: string; command: string }) {
  return (
    <div className="grid grid-cols-[90px_1fr] gap-4 items-center py-2.5 border-t border-[var(--border-subtle)]">
      <div className="font-body text-[13px] text-[var(--ink-40)]">{label}</div>
      <code className="font-mono text-[13px] text-[var(--ink-80)]">
        <span className="text-[var(--accent)] select-none">$ </span>
        {command}
      </code>
    </div>
  );
}

/** A small pill linking to a package registry / repo. */
function MetaBadge({ prefix, value, href }: { prefix: string; value: string; href?: string }) {
  const inner = (
    <span className="inline-flex items-center rounded-[var(--radius-sm)] border border-[var(--border-subtle)] overflow-hidden text-[12px]">
      <span className="px-2 py-1 bg-[var(--bg-surface-2)] text-[var(--ink-50)] font-body">{prefix}</span>
      <span className="px-2 py-1 bg-[var(--bg-surface)] text-[var(--ink-80)] font-mono">{value}</span>
    </span>
  );
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
      {inner}
    </a>
  ) : (
    inner
  );
}

export default function Home() {
  const [markdown, setMarkdown] = useState<string>(DEFAULT_MD);
  const [title, setTitle] = useState("My Document");
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isDocxLoading, setIsDocxLoading] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [editorExpanded, setEditorExpanded] = useState(false);

  useEffect(() => {
    // Sync theme with html tag
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const parsedBlocks = useMemo(() => parseBlocks(markdown), [markdown]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setTitle(file.name.replace(/\.md$/i, ""));
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setMarkdown(e.target.result as string);
        }
      };
      reader.readAsText(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/markdown": [".md"] },
    multiple: false,
    noClick: true,
  });

  const downloadFile = async (type: "pdf" | "docx") => {
    try {
      if (type === "pdf") setIsPdfLoading(true);
      else setIsDocxLoading(true);

      const response = await fetch(`/api/export/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown, title }),
      });

      if (!response.ok) throw new Error("Failed to export");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.${type}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error(error);
      alert(`Failed to download ${type.toUpperCase()}`);
    } finally {
      setIsPdfLoading(false);
      setIsDocxLoading(false);
    }
  };

  const renderPreview = () => (
    <div className="prose prose-slate max-w-none prose-headings:text-[var(--ink-100)] prose-p:text-[var(--ink-80)] prose-strong:text-[var(--ink-100)] prose-a:text-[var(--accent)] prose-a:no-underline hover:prose-a:underline prose-code:text-[var(--ink-100)] prose-code:bg-[var(--bg-surface-2)] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded">
      {parsedBlocks.map((block) => {
        if (block.type === 'markdown') {
          return <ReactMarkdown key={block.id} remarkPlugins={[remarkGfm]}>{block.content || ''}</ReactMarkdown>;
        }
        switch (block.type) {
          case 'chart':
            return <ChartBlockRenderer key={block.id} data={block.data} />;
          case 'workflow_timeline':
            return <WorkflowTimelineRenderer key={block.id} {...block.props} data={block.data} />;
          case 'goal_timeline':
            return <GoalTimelineRenderer key={block.id} {...block.props} data={block.data} />;
          case 'metrics_grid':
            return <MetricsGridRenderer key={block.id} {...block.props} data={block.data} />;
          case 'campaign_performance':
            return <CampaignPerformanceRenderer key={block.id} {...block.props} />;
          case 'content_calendar':
            return <ContentCalendarRenderer key={block.id} {...block.props} data={block.data} />;
          case 'progress':
            return <ProgressRenderer key={block.id} {...block.props} data={block.data} />;
          case 'lead_list':
            return <LeadListRenderer key={block.id} {...block.props} data={block.data} />;
          case 'revenue_attribution':
            return <RevenueAttributionRenderer key={block.id} {...block.props} data={block.data} />;
          case 'card':
            return <CardBlockRenderer key={block.id} {...block.props}>{block.data}</CardBlockRenderer>;
          default:
            return (
              <div key={block.id} className="p-4 border border-[var(--warning)] bg-[var(--warning-subtle)] text-[var(--warning)] rounded my-4">
                Unknown block type: {block.type}
              </div>
            );
        }
      })}
    </div>
  );

  return (
    <div {...getRootProps()} className="min-h-screen bg-[var(--bg-base)] font-sans transition-colors duration-300">
      <input {...getInputProps()} id="file-upload" />

      {isDragActive && (
        <div className="fixed inset-0 z-50 bg-[var(--bg-overlay)] backdrop-blur-sm flex items-center justify-center transition-all">
          <div className="bg-[var(--bg-surface)] p-8 rounded-xl shadow-xl flex flex-col items-center gap-4 border-2 border-dashed border-[var(--accent)] animate-in fade-in zoom-in duration-200">
            <UploadSimple size={48} className="text-[var(--accent)]" />
            <h2 className="text-xl font-semibold text-[var(--ink-100)]">Drop Markdown File Here</h2>
          </div>
        </div>
      )}

      {/* ─── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-[var(--bg-surface)]/90 backdrop-blur-md border-b border-[var(--border-subtle)] transition-colors duration-300">
        <div className="max-w-[960px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={theme === 'dark' ? '/logo-dark.svg' : '/logo-light.svg'} alt="" className="h-6 w-auto" />
            <span className="font-display font-semibold text-[15px] text-[var(--ink-100)] tracking-tight">mdforge</span>
            <span className="font-body text-[13px] text-[var(--ink-40)]">by PostAmico</span>
          </div>
          <nav className="flex items-center gap-1">
            <a href={LINKS.github} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-[var(--radius-sm)] font-body text-[13px] text-[var(--ink-60)] hover:text-[var(--ink-100)] hover:bg-[var(--bg-surface-2)] transition-colors">GitHub</a>
            <a href={LINKS.npm} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-[var(--radius-sm)] font-body text-[13px] text-[var(--ink-60)] hover:text-[var(--ink-100)] hover:bg-[var(--bg-surface-2)] transition-colors">npm</a>
            <a href="#install" className="px-3 py-1.5 rounded-[var(--radius-sm)] font-body text-[13px] text-[var(--ink-60)] hover:text-[var(--ink-100)] hover:bg-[var(--bg-surface-2)] transition-colors">Install</a>
            <button onClick={toggleTheme} className="ml-1 w-8 h-8 flex items-center justify-center rounded-full text-[var(--ink-60)] hover:text-[var(--ink-100)] hover:bg-[var(--bg-surface-2)] transition-colors" title="Toggle theme">
              {theme === 'dark' ? <Sun size={17} weight="bold" /> : <Moon size={17} weight="bold" />}
            </button>
          </nav>
        </div>
      </header>

      <div className="max-w-[960px] mx-auto px-6">

        {/* ─── Hero ─────────────────────────────────────────────── */}
        <section className="pt-16 pb-10">
          <h1 className="font-display font-semibold text-[clamp(2.4rem,6vw,3.6rem)] leading-[1.05] tracking-[-0.02em] text-[var(--ink-100)]">
            Markdown in.
            <br />
            <span className="text-[var(--accent)]">Documents out.</span>
          </h1>
          <p className="mt-5 max-w-[560px] font-body text-[15px] leading-relaxed text-[var(--ink-60)]">
            A lightweight Node library that turns Markdown — with JSON charts and tables — into polished
            <strong className="text-[var(--ink-80)] font-semibold"> PDF</strong> and editable
            <strong className="text-[var(--ink-80)] font-semibold"> Word (.docx)</strong> documents.
            No headless browser, no Chromium. Drop it into your app to turn LLM output into reports.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <MetaBadge prefix="npm" value="@postamico/mdforge" href={LINKS.npm} />
            <MetaBadge prefix="github" value="PostAmico/mdforge" href={LINKS.github} />
            <MetaBadge prefix="license" value="MIT" />
            <MetaBadge prefix="size" value="~80 kB" />
          </div>
        </section>

        {/* ─── The Tool (compact, expandable) ───────────────────── */}
        <section className="pb-8">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)] overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-2)]/50 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-body text-[13px] font-medium text-[var(--ink-80)]">Live playground</span>
                <span className="font-body text-[12px] text-[var(--ink-40)]">— edit or drop a .md file</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--bg-surface)] rounded-[var(--radius-sm)] border border-[var(--border-subtle)] focus-within:border-[var(--accent)] transition-colors">
                  <Settings size={14} className="text-[var(--ink-40)]" />
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="bg-transparent border-none outline-none text-[13px] font-medium text-[var(--ink-80)] w-28 placeholder:text-[var(--ink-40)]"
                    placeholder="Title"
                  />
                </div>
                <label htmlFor="file-upload" className="flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer text-[var(--ink-60)] hover:text-[var(--ink-100)] hover:bg-[var(--bg-surface)] rounded-[var(--radius-sm)] border border-transparent hover:border-[var(--border-subtle)] transition-colors">
                  <UploadSimple size={15} />
                  <span className="font-body text-[13px] font-medium">Upload</span>
                </label>
                <button
                  onClick={() => downloadFile("docx")}
                  disabled={isDocxLoading || !markdown}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-surface)] text-[var(--ink-100)] font-medium text-[13px] rounded-[var(--radius-sm)] border border-[var(--border-default)] hover:bg-[var(--bg-surface-2)] transition-all disabled:opacity-50"
                >
                  {isDocxLoading ? <Loader2 size={14} className="animate-spin" /> : <FileDoc size={14} />}
                  DOCX
                </button>
                <button
                  onClick={() => downloadFile("pdf")}
                  disabled={isPdfLoading || !markdown}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white font-medium text-[13px] rounded-[var(--radius-sm)] hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {isPdfLoading ? <Loader2 size={14} className="animate-spin text-white" /> : <FilePdf size={14} className="text-white" />}
                  PDF
                </button>
              </div>
            </div>

            {/* Editor + Preview, compact by default */}
            <div className={`grid grid-cols-1 md:grid-cols-2 transition-[height] duration-300 ${editorExpanded ? 'h-[70vh]' : 'h-[340px]'}`}>
              <div className="relative border-b md:border-b-0 md:border-r border-[var(--border-subtle)] overflow-hidden">
                <span className="absolute top-2.5 right-3 px-1.5 py-0.5 bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] rounded text-[11px] font-mono text-[var(--ink-40)] pointer-events-none z-10">markdown</span>
                <textarea
                  value={markdown}
                  onChange={(e) => setMarkdown(e.target.value)}
                  className="w-full h-full p-5 resize-none outline-none text-[var(--ink-80)] font-mono text-[12.5px] leading-relaxed bg-transparent"
                  placeholder="Type or drag & drop your markdown here..."
                  spellCheck={false}
                />
              </div>
              <div className="relative overflow-y-auto bg-[var(--bg-base)]">
                <span className="absolute top-2.5 right-3 px-1.5 py-0.5 bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] rounded text-[11px] font-mono text-[var(--ink-40)] pointer-events-none z-10">preview</span>
                <div className="p-5">{renderPreview()}</div>
              </div>
            </div>

            {/* Expand / collapse */}
            <button
              onClick={() => setEditorExpanded((v) => !v)}
              className="w-full flex items-center justify-center gap-1.5 py-2 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-2)]/50 font-body text-[12.5px] font-medium text-[var(--ink-60)] hover:text-[var(--ink-100)] hover:bg-[var(--bg-surface-2)] transition-colors"
            >
              {editorExpanded ? <><CaretUp size={13} /> Show less</> : <><CaretDown size={13} /> Expand editor</>}
            </button>
          </div>
        </section>

        {/* ─── About ────────────────────────────────────────────── */}
        <section className="py-8">
          <h2 className="font-display font-semibold text-[20px] text-[var(--ink-100)] mb-1">What it does</h2>
          <div className="mt-4">
            <InfoRow label="One input">
              You write <strong className="text-[var(--ink-100)] font-semibold">Markdown</strong>. Standard GitHub-Flavored Markdown — headings, tables, lists, code, blockquotes — plus fenced <code>json-chart</code> blocks and a set of structured content tags.
            </InfoRow>
            <InfoRow label="Two outputs">
              Get a ready-to-share <strong className="text-[var(--ink-100)] font-semibold">PDF</strong>, or an editable <strong className="text-[var(--ink-100)] font-semibold">Word .docx</strong> you can keep working on. Same content, one call each.
            </InfoRow>
            <InfoRow label="No browser">
              PDFs render with pdfkit and Word docs with the docx library — both pure JavaScript. No Chromium, no Puppeteer, no Playwright. Small, fast, and easy to run in serverless or CI.
            </InfoRow>
            <InfoRow label="Charts">
              Drop a JSON chart into your Markdown and it renders as a crisp, high-resolution image, with value labels. A forgiving normalizer accepts the loosely-shaped JSON that LLMs produce. Charts are optional — install <code>canvas</code> only when you need them.
            </InfoRow>
            <InfoRow label="Built for AI">
              Turn an LLM&apos;s Markdown answer into a structured report your users can download. The API returns a Buffer, so stream it, email it, or serve it from a route.
            </InfoRow>
            <InfoRow label="Lightweight">
              ~80 kB packed, three runtime dependencies. This page is the same library running behind a small Next.js demo.
            </InfoRow>
          </div>
        </section>

        {/* ─── Install ──────────────────────────────────────────── */}
        <section id="install" className="py-8 scroll-mt-20">
          <h2 className="font-display font-semibold text-[20px] text-[var(--ink-100)] mb-1">Install</h2>
          <div className="mt-4">
            <InstallRow label="Core" command="npm install @postamico/mdforge" />
            <InstallRow label="+ Charts" command="npm install @postamico/mdforge canvas chart.js" />
          </div>
          <div className="mt-6 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
            <pre className="font-mono text-[12.5px] leading-relaxed text-[var(--ink-80)] overflow-x-auto"><code>{`import { markdownToPdf } from "@postamico/mdforge";

const pdf = await markdownToPdf(markdown, { title: "Report" });
// pdf is a Buffer — save it, stream it, or return it from an API`}</code></pre>
          </div>
          <p className="mt-4 font-body text-[13.5px] text-[var(--ink-60)] leading-relaxed">
            The chart normalizer is also available on its own at <code>@postamico/mdforge/chart-normalizer</code>. Full usage, the chart schema, and the supported chart types are in the{" "}
            <a href={`${LINKS.github}#readme`} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">README</a>.
          </p>
        </section>

        {/* Feature chips */}
        <section className="py-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
              <Lightning size={20} className="text-[var(--accent)] mb-2" weight="fill" />
              <div className="font-body font-semibold text-[14px] text-[var(--ink-100)]">Fast &amp; local</div>
              <div className="font-body text-[13px] text-[var(--ink-60)] mt-0.5">Pure Node. No browser to boot, nothing leaves your server.</div>
            </div>
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
              <ChartBar size={20} className="text-[var(--accent)] mb-2" weight="fill" />
              <div className="font-body font-semibold text-[14px] text-[var(--ink-100)]">22 chart types</div>
              <div className="font-body text-[13px] text-[var(--ink-60)] mt-0.5">Bar, line, pie, funnel, sankey, heatmap, and more — from JSON.</div>
            </div>
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
              <Package size={20} className="text-[var(--accent)] mb-2" weight="fill" />
              <div className="font-body font-semibold text-[14px] text-[var(--ink-100)]">Drop-in</div>
              <div className="font-body text-[13px] text-[var(--ink-60)] mt-0.5">Install from npm, or clone the repo and use it in your project.</div>
            </div>
          </div>
        </section>

        {/* ─── Footer ───────────────────────────────────────────── */}
        <footer className="mt-8 py-8 border-t border-[var(--border-subtle)] flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="font-body text-[13px] text-[var(--ink-40)]">MIT License</span>
          <a href={LINKS.github} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 font-body text-[13px] text-[var(--ink-60)] hover:text-[var(--ink-100)] transition-colors"><GithubLogo size={15} /> Source</a>
          <a href={LINKS.issues} target="_blank" rel="noopener noreferrer" className="font-body text-[13px] text-[var(--ink-60)] hover:text-[var(--ink-100)] transition-colors">Issues</a>
          <a href={LINKS.npm} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 font-body text-[13px] text-[var(--ink-60)] hover:text-[var(--ink-100)] transition-colors"><Package size={15} /> npm</a>
          <span className="ml-auto font-body text-[13px] text-[var(--ink-40)]">
            Built by <a href={LINKS.postamico} target="_blank" rel="noopener noreferrer" className="text-[var(--ink-60)] hover:text-[var(--accent)] transition-colors">PostAmico</a>
          </span>
        </footer>

      </div>
    </div>
  );
}
