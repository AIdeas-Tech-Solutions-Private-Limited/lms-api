import { Request, Response } from "express";
import { db } from "../db";
import { categories, courses } from "../db/schema";
import { eq, like, sql } from "drizzle-orm";

export const createCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { name, slug } = req.body;

    if (!name || !slug) {
      res.status(400).json({ message: "Name and slug are required" });
      return;
    }

    const existing = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ message: "Category slug already exists" });
      return;
    }

    const newCategory = await db
      .insert(categories)
      .values({ name, slug })
      .returning();

    res.status(201).json({ category: newCategory[0] });
  } catch (error) {
    console.error("CreateCategory error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getCategories = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const allCategories = await db.select().from(categories);
    res.status(200).json({ categories: allCategories });
  } catch (error) {
    console.error("GetCategories error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getCategoryBySlug = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const slug = req.params.slug as string;

    const category = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1);

    if (category.length === 0) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    res.status(200).json({ category: category[0] });
  } catch (error) {
    console.error("GetCategoryBySlug error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name, slug } = req.body;

    const updated = await db
      .update(categories)
      .set({ name, slug, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();

    if (updated.length === 0) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    res.status(200).json({ category: updated[0] });
  } catch (error) {
    console.error("UpdateCategory error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = req.params.id as string;

    const deleted = await db
      .delete(categories)
      .where(eq(categories.id, id))
      .returning();

    if (deleted.length === 0) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("DeleteCategory error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
