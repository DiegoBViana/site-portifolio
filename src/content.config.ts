import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { SKILL_ICONS } from './lib/skill-icons';
// data/personal (seus dados, fora do Git) ou data/example (dados fictícios): veja data-dir.mjs
import { dataName } from '../data-dir.mjs';

/** A string translated into every supported language. */
const l10n = z.object({ pt: z.string(), en: z.string() });

const httpMethod = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

/** One ready-made request shown in the "Testar a API" console. */
const apiRequest = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: l10n,
  /** Short label for the phone chip list, e.g. "Token". Defaults to `name`. */
  shortName: l10n.optional(),
  /** Second line in the request list, e.g. "/pedidos/{id}". Defaults to `path`. */
  hint: z.string().optional(),
  description: l10n.optional(),
  /** Shown under the response: what to notice / what to try next. */
  tip: l10n.optional(),
  method: httpMethod,
  /** Path appended to `demo.baseUrl`, e.g. `/api/orders/42`. */
  path: z.string().startsWith('/'),
  headers: z.record(z.string(), z.string()).default({}),
  /** Request body as text (usually JSON). Editable by the visitor. */
  body: z.string().optional(),
  /** Recorded response shown when the live demo is asleep or unreachable. */
  sample: z.object({
    status: z.number().int().min(100).max(599),
    latencyMs: z.number().nonnegative().optional(),
    /** Notable response headers to show above the body, e.g. Idempotent-Replayed: true */
    headers: z.record(z.string(), z.string()).default({}),
    body: z.unknown(),
  }),
});

const projects = defineCollection({
  // One YAML file per project. The file name is the project slug used in URLs.
  loader: glob({ pattern: '**/*.{yaml,yml}', base: `./data/${dataName}/content/projects` }),
  schema: z.object({
    order: z.number().default(100),
    featured: z.boolean().default(true),
    draft: z.boolean().default(false),
    title: l10n,
    summary: l10n,
    stack: z.array(z.string()).min(1),
    /** Home card: one-line problem and the headline number. */
    card: z.object({
      problem: l10n,
      metric: z.object({ value: z.string(), caption: l10n }).optional(),
      /**
       * Themed diagram at the top of the card: an SVG file in data/<pasta>/content/projects/thumbnails/
       * drawn with the .th-* classes (colours come from the theme tokens) and `{{pt|en}}` labels.
       */
      thumbnail: z.object({ svg: z.string().regex(/^[a-z0-9-]+\.svg$/), alt: l10n }).optional(),
    }),
    repo: z.url().optional(),
    /** Private code: no repository link; the panel says the code is shown in interviews. */
    privateRepo: z.boolean().default(false),
    demo: z.object({
      /** Base URL of the live demo API (no trailing slash). */
      baseUrl: z.url(),
      /** Abort the live call after this many ms and show the recorded response. */
      timeoutMs: z.number().int().positive().default(6000),
      /**
       * `live`: the console calls baseUrl and falls back to recorded responses.
       * `recorded`: no live deployment yet; the console shows recorded responses directly.
       */
      mode: z.enum(['live', 'recorded']).default('live'),
      /** Small print next to the live indicator, e.g. "dados resetados a cada hora". */
      note: l10n.optional(),
    }),
    overview: z.object({
      problem: l10n,
      solution: l10n.optional(),
      /**
       * Layered architecture diagram rendered as HTML (themeable). Each column is a
       * top-to-bottom stack joined by arrows.
       */
      architecture: z
        .object({
          alt: l10n,
          columns: z
            .array(
              z.array(
                z.object({
                  name: z.string(),
                  description: l10n.optional(),
                  variant: z.enum(['default', 'primary', 'dashed']).default('default'),
                }),
              ),
            )
            .min(1),
        })
        .optional(),
      /** Alternative: an image/SVG diagram under /public. */
      diagram: z
        .object({
          /** Path under /public, e.g. /projects/api-pedidos/arquitetura.svg */
          src: z.string(),
          alt: l10n,
        })
        .optional(),
      metrics: z.array(z.object({ label: l10n, value: z.string() })).default([]),
    }),
    requests: z.array(apiRequest).default([]),
    snippets: z
      .array(
        z.object({
          title: l10n,
          file: z.string().optional(),
          lang: z.string().default('csharp'),
          code: z.string(),
        }),
      )
      .default([]),
    media: z
      .object({
        type: z.enum(['video', 'image']),
        /** Path under /public (mp4/webm for video; gif/svg/png/webp for image). */
        src: z.string(),
        poster: z.string().optional(),
        alt: l10n,
        caption: l10n.optional(),
      })
      .optional(),
  }),
});

const experience = defineCollection({
  loader: glob({ pattern: '**/*.{yaml,yml}', base: `./data/${dataName}/content/experience` }),
  schema: z.object({
    order: z.number(),
    company: z.string(),
    role: l10n,
    period: l10n,
    /** Ongoing role: filled node on the timeline. */
    current: z.boolean().default(false),
    location: l10n.optional(),
    highlights: z.array(l10n).default([]),
  }),
});

const skills = defineCollection({
  loader: glob({ pattern: '**/*.{yaml,yml}', base: `./data/${dataName}/content/skills` }),
  schema: z.object({
    order: z.number(),
    title: l10n,
    /** Tile icon, see src/components/SkillIcon.astro. */
    icon: z.enum(SKILL_ICONS).default('code'),
    /** Plain strings (same in both languages) or { pt, en }. */
    items: z.array(z.union([z.string(), l10n])).min(1),
  }),
});

const articles = defineCollection({
  loader: glob({ pattern: '**/*.{yaml,yml}', base: `./data/${dataName}/content/articles` }),
  schema: z.object({
    draft: z.boolean().default(false),
    title: l10n,
    summary: l10n,
    url: z.url(),
    date: z.coerce.date(),
  }),
});

export const collections = { projects, experience, skills, articles };
