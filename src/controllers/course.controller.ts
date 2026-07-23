import { Request, Response } from "express";
import { db } from "../db";
import { courses, categories, sessions } from "../db/schema";
import { eq, ilike, and, desc, sql, count } from "drizzle-orm";

export const createCourse = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { title, slug, description, thumbnail, level, duration, instructor, categoryId, published } =
      req.body;

    if (!title || !slug || !description) {
      res.status(400).json({ message: "Title, slug, and description are required" });
      return;
    }

    const existing = await db
      .select()
      .from(courses)
      .where(eq(courses.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ message: "Course slug already exists" });
      return;
    }

    const newCourse = await db
      .insert(courses)
      .values({
        title,
        slug,
        description,
        thumbnail,
        level: level || "beginner",
        duration,
        instructor,
        categoryId,
        published: published ?? false,
      })
      .returning();

    res.status(201).json({ course: newCourse[0] });
  } catch (error) {
    console.error("CreateCourse error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getCourses = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, level, search, page = "1", limit = "12" } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    const conditions = [eq(courses.published, true)];

    if (category) {
      conditions.push(eq(courses.categoryId, category as string));
    }

    if (level) {
      conditions.push(eq(courses.level, level as string));
    }

    if (search) {
      conditions.push(ilike(courses.title, `%${search}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const allCourses = await db
      .select({
        id: courses.id,
        title: courses.title,
        slug: courses.slug,
        description: courses.description,
        thumbnail: courses.thumbnail,
        level: courses.level,
        duration: courses.duration,
        instructor: courses.instructor,
        categoryId: courses.categoryId,
        published: courses.published,
        createdAt: courses.createdAt,
        categoryName: categories.name,
      })
      .from(courses)
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .where(whereClause)
      .orderBy(desc(courses.createdAt))
      .limit(limitNum)
      .offset(offset);

    const [{ totalCount }] = await db
      .select({ totalCount: count() })
      .from(courses)
      .where(whereClause);

    res.status(200).json({
      courses: allCourses,
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (error) {
    console.error("GetCourses error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getCourseBySlug = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const slug = req.params.slug as string;

    const course = await db
      .select({
        id: courses.id,
        title: courses.title,
        slug: courses.slug,
        description: courses.description,
        thumbnail: courses.thumbnail,
        level: courses.level,
        duration: courses.duration,
        instructor: courses.instructor,
        categoryId: courses.categoryId,
        published: courses.published,
        createdAt: courses.createdAt,
        categoryName: categories.name,
      })
      .from(courses)
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .where(eq(courses.slug, slug))
      .limit(1);

    if (course.length === 0) {
      res.status(404).json({ message: "Course not found" });
      return;
    }

    const courseSessions = await db
      .select()
      .from(sessions)
      .where(eq(sessions.courseId, course[0].id))
      .orderBy(sessions.order);

    const [{ sessionCount }] = await db
      .select({ sessionCount: count() })
      .from(sessions)
      .where(eq(sessions.courseId, course[0].id));

    res.status(200).json({
      course: { ...course[0], sessionCount },
      sessions: courseSessions,
    });
  } catch (error) {
    console.error("GetCourseBySlug error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getCourseById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = req.params.id as string;

    const course = await db
      .select()
      .from(courses)
      .where(eq(courses.id, id))
      .limit(1);

    if (course.length === 0) {
      res.status(404).json({ message: "Course not found" });
      return;
    }

    res.status(200).json({ course: course[0] });
  } catch (error) {
    console.error("GetCourseById error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateCourse = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { title, slug, description, thumbnail, level, duration, instructor, categoryId, published } =
      req.body;

    const updated = await db
      .update(courses)
      .set({
        title,
        slug,
        description,
        thumbnail,
        level,
        duration,
        instructor,
        categoryId,
        published,
        updatedAt: new Date(),
      })
      .where(eq(courses.id, id))
      .returning();

    if (updated.length === 0) {
      res.status(404).json({ message: "Course not found" });
      return;
    }

    res.status(200).json({ course: updated[0] });
  } catch (error) {
    console.error("UpdateCourse error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteCourse = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = req.params.id as string;

    const deleted = await db
      .delete(courses)
      .where(eq(courses.id, id))
      .returning();

    if (deleted.length === 0) {
      res.status(404).json({ message: "Course not found" });
      return;
    }

    res.status(200).json({ message: "Course deleted successfully" });
  } catch (error) {
    console.error("DeleteCourse error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getCoursesAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const allCourses = await db
      .select({
        id: courses.id,
        title: courses.title,
        slug: courses.slug,
        description: courses.description,
        thumbnail: courses.thumbnail,
        level: courses.level,
        duration: courses.duration,
        instructor: courses.instructor,
        categoryId: courses.categoryId,
        published: courses.published,
        createdAt: courses.createdAt,
        categoryName: categories.name,
      })
      .from(courses)
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .orderBy(desc(courses.createdAt));

    res.status(200).json({ courses: allCourses });
  } catch (error) {
    console.error("GetCoursesAdmin error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getFeaturedCourses = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const featured = await db
      .select({
        id: courses.id,
        title: courses.title,
        slug: courses.slug,
        description: courses.description,
        thumbnail: courses.thumbnail,
        level: courses.level,
        duration: courses.duration,
        instructor: courses.instructor,
        categoryName: categories.name,
      })
      .from(courses)
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .where(eq(courses.published, true))
      .orderBy(desc(courses.createdAt))
      .limit(6);

    res.status(200).json({ courses: featured });
  } catch (error) {
    console.error("GetFeaturedCourses error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
