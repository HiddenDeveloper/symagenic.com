import { defineCollection, z } from 'astro:content';

const blogCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.date(),
    author: z.string().default('Project Stone Monkey'),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const stepsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    section: z.number(),
    title: z.string(),
    subtitle: z.string(),
    icon: z.string(),
    slug: z.string().optional(),
    lastVerified: z.string(),
    draft: z.boolean().default(false),
    status: z.string().optional(),
  }),
});

const journeyCollection = defineCollection({
  type: 'content',
  schema: z.object({
    section: z.number(),
    title: z.string(),
    subtitle: z.string(),
    icon: z.string(),
    slug: z.string().optional(),
    lastVerified: z.string(),
    draft: z.boolean().default(false),
  }),
});

export const collections = {
  blog: blogCollection,
  steps: stepsCollection,
  journey: journeyCollection,
};
