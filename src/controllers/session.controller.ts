import { Request, Response } from "express";
import { db } from "../db";
import { sessions } from "../db/schema";
import { eq } from "drizzle-orm";

export const createSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { title, description, videoUrl, pdfUrl, order, courseId, sessionDate, duration, published } = req.body;

    if (!title || !courseId) {
      res.status(400).json({ message: "Title and courseId are required" });
      return;
    }

    const newSession = await db
      .insert(sessions)
      .values({
        title,
        description,
        videoUrl,
        pdfUrl,
        order: order || 0,
        courseId,
        sessionDate: sessionDate ? new Date(sessionDate) : null,
        duration: duration || null,
        published: published ?? true,
      })
      .returning();

    res.status(201).json({ session: newSession[0] });
  } catch (error) {
    console.error("CreateSession error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getSessionsByCourse = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const courseId = req.params.courseId as string;

    const courseSessions = await db
      .select()
      .from(sessions)
      .where(eq(sessions.courseId, courseId))
      .orderBy(sessions.order);

    res.status(200).json({ sessions: courseSessions });
  } catch (error) {
    console.error("GetSessionsByCourse error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getSessionById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = req.params.id as string;

    const session = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);

    if (session.length === 0) {
      res.status(404).json({ message: "Session not found" });
      return;
    }

    res.status(200).json({ session: session[0] });
  } catch (error) {
    console.error("GetSessionById error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { title, description, videoUrl, pdfUrl, order, sessionDate, duration, published } = req.body;

    const updated = await db
      .update(sessions)
      .set({
        title,
        description,
        videoUrl,
        pdfUrl,
        order,
        sessionDate: sessionDate ? new Date(sessionDate) : null,
        duration,
        published,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, id))
      .returning();

    if (updated.length === 0) {
      res.status(404).json({ message: "Session not found" });
      return;
    }

    res.status(200).json({ session: updated[0] });
  } catch (error) {
    console.error("UpdateSession error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = req.params.id as string;

    const deleted = await db
      .delete(sessions)
      .where(eq(sessions.id, id))
      .returning();

    if (deleted.length === 0) {
      res.status(404).json({ message: "Session not found" });
      return;
    }

    res.status(200).json({ message: "Session deleted successfully" });
  } catch (error) {
    console.error("DeleteSession error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
