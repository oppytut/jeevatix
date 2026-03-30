import { getDb, schema } from '@jeevatix/core';
import { eq, sql } from 'drizzle-orm';

import type {
  CategoryMessagePayload,
  CategoryResponse,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../schemas/category.schema';

const { categories, eventCategories } = schema;

type CategoryRow = typeof categories.$inferSelect;

export class CategoryServiceError extends Error {
  constructor(
    public readonly code:
      | 'CATEGORY_ALREADY_EXISTS'
      | 'CATEGORY_HAS_EVENTS'
      | 'CATEGORY_NOT_FOUND'
      | 'CATEGORY_SLUG_ALREADY_EXISTS'
      | 'DATABASE_UNAVAILABLE',
    message: string,
  ) {
    super(message);
    this.name = 'CategoryServiceError';
  }
}

function getDatabase(databaseUrl?: string) {
  const db = getDb(databaseUrl);

  if (!db) {
    throw new CategoryServiceError('DATABASE_UNAVAILABLE', 'Database connection is not available.');
  }

  return db;
}

function slugifyCategoryName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function toCategoryResponse(category: CategoryRow, eventCount?: number): CategoryResponse {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    icon: category.icon ?? null,
    ...(eventCount !== undefined ? { eventCount } : {}),
  };
}

async function getCategoryById(id: number, databaseUrl?: string) {
  const database = getDatabase(databaseUrl);

  return database.query.categories.findFirst({
    where: eq(categories.id, id),
  });
}

async function ensureCategoryNameUnique(name: string, excludeId?: number, databaseUrl?: string) {
  const database = getDatabase(databaseUrl);
  const whereClause = excludeId
    ? sql<boolean>`lower(${categories.name}) = lower(${name}) and ${categories.id} <> ${excludeId}`
    : sql<boolean>`lower(${categories.name}) = lower(${name})`;

  const existingCategory = await database.query.categories.findFirst({
    where: whereClause,
  });

  if (existingCategory) {
    throw new CategoryServiceError('CATEGORY_ALREADY_EXISTS', 'Category name already exists.');
  }
}

async function ensureCategorySlugUnique(slug: string, excludeId?: number, databaseUrl?: string) {
  const database = getDatabase(databaseUrl);
  const whereClause = excludeId
    ? sql<boolean>`lower(${categories.slug}) = lower(${slug}) and ${categories.id} <> ${excludeId}`
    : sql<boolean>`lower(${categories.slug}) = lower(${slug})`;

  const existingCategory = await database.query.categories.findFirst({
    where: whereClause,
  });

  if (existingCategory) {
    throw new CategoryServiceError(
      'CATEGORY_SLUG_ALREADY_EXISTS',
      'Generated category slug already exists.',
    );
  }
}

async function getAttachedEventCount(categoryId: number, databaseUrl?: string) {
  const database = getDatabase(databaseUrl);
  const [result] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(eventCategories)
    .where(eq(eventCategories.categoryId, categoryId));

  return result?.count ?? 0;
}

export const categoryService = {
  async listAdmin(databaseUrl?: string): Promise<CategoryResponse[]> {
    const database = getDatabase(databaseUrl);
    const rows = await database
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        icon: categories.icon,
        eventCount: sql<number>`count(${eventCategories.eventId})::int`,
      })
      .from(categories)
      .leftJoin(eventCategories, eq(eventCategories.categoryId, categories.id))
      .groupBy(categories.id, categories.name, categories.slug, categories.icon)
      .orderBy(categories.name);

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      icon: row.icon ?? null,
      eventCount: row.eventCount,
    }));
  },

  async create(input: CreateCategoryInput, databaseUrl?: string): Promise<CategoryResponse> {
    const name = input.name.trim();
    const slug = slugifyCategoryName(name);

    await ensureCategoryNameUnique(name, undefined, databaseUrl);
    await ensureCategorySlugUnique(slug, undefined, databaseUrl);

    const database = getDatabase(databaseUrl);
    const [category] = await database
      .insert(categories)
      .values({
        name,
        slug,
        icon: input.icon?.trim() || null,
      })
      .returning();

    return toCategoryResponse(category, 0);
  },

  async update(
    id: number,
    input: UpdateCategoryInput,
    databaseUrl?: string,
  ): Promise<CategoryResponse> {
    const existingCategory = await getCategoryById(id, databaseUrl);

    if (!existingCategory) {
      throw new CategoryServiceError('CATEGORY_NOT_FOUND', 'Category not found.');
    }

    const nextName = input.name !== undefined ? input.name.trim() : existingCategory.name;
    const nextSlug =
      input.name !== undefined ? slugifyCategoryName(nextName) : existingCategory.slug;

    if (input.name !== undefined) {
      await ensureCategoryNameUnique(nextName, id, databaseUrl);
      await ensureCategorySlugUnique(nextSlug, id, databaseUrl);
    }

    const values: Partial<typeof categories.$inferInsert> = {};

    if (input.name !== undefined) {
      values.name = nextName;
      values.slug = nextSlug;
    }

    if (input.icon !== undefined) {
      values.icon = input.icon.trim() || null;
    }

    if (Object.keys(values).length === 0) {
      const eventCount = await getAttachedEventCount(id, databaseUrl);
      return toCategoryResponse(existingCategory, eventCount);
    }

    const database = getDatabase(databaseUrl);
    const [category] = await database
      .update(categories)
      .set(values)
      .where(eq(categories.id, id))
      .returning();

    if (!category) {
      throw new CategoryServiceError('CATEGORY_NOT_FOUND', 'Category not found.');
    }

    const eventCount = await getAttachedEventCount(id, databaseUrl);
    return toCategoryResponse(category, eventCount);
  },

  async remove(id: number, databaseUrl?: string): Promise<CategoryMessagePayload> {
    const existingCategory = await getCategoryById(id, databaseUrl);

    if (!existingCategory) {
      throw new CategoryServiceError('CATEGORY_NOT_FOUND', 'Category not found.');
    }

    const attachedEventCount = await getAttachedEventCount(id, databaseUrl);

    if (attachedEventCount > 0) {
      throw new CategoryServiceError(
        'CATEGORY_HAS_EVENTS',
        'Category cannot be deleted because it is still assigned to events.',
      );
    }

    const database = getDatabase(databaseUrl);
    const [deletedCategory] = await database
      .delete(categories)
      .where(eq(categories.id, id))
      .returning({ id: categories.id });

    if (!deletedCategory) {
      throw new CategoryServiceError('CATEGORY_NOT_FOUND', 'Category not found.');
    }

    return {
      message: 'Category deleted successfully.',
    };
  },
};
