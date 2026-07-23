import { Request, Response } from "express";
import { db } from "../db";
import { sessionProgress, sessions } from "../db/schema";
import { eq, and, count } from "drizzle-orm";
import { AuthRequest } from "../middleware/auth";

export const markSessionComplete = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.userId;
    const sessionId = req.params.sessionId as string;

    const session = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (session.length === 0) {
      res.status(404).json({ message: "Session not found" });
      return;
    }

    const existing = await db
      .select()
      .from(sessionProgress)
      .where(
        and(eq(sessionProgress.userId, userId!), eq(sessionProgress.sessionId, sessionId))
      )
      .limit(1);

    if (existing.length > 0) {
      const updated = await db
        .update(sessionProgress)
        .set({ completed: true, completedAt: new Date() })
        .where(eq(sessionProgress.id, existing[0].id))
        .returning();

      res.status(200).json({ progress: updated[0] });
      return;
    }

    const newProgress = await db
      .insert(sessionProgress)
      .values({
        userId: userId!,
        sessionId,
        completed: true,
        completedAt: new Date(),
      })
      .returning();

    res.status(201).json({ progress: newProgress[0] });
  } catch (error) {
    console.error("MarkSessionComplete error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getSessionProgress = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.userId;
    const sessionId = req.params.sessionId as string;

    const progress = await db
      .select()
      .from(sessionProgress)
      .where(
        and(eq(sessionProgress.userId, userId!), eq(sessionProgress.sessionId, sessionId))
      )
      .limit(1);

    res.status(200).json({
      completed: progress.length > 0 ? progress[0].completed : false,
    });
  } catch (error) {
    console.error("GetSessionProgress error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getCourseProgress = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.userId;
    const courseId = req.params.courseId as string;

    const [{ totalSessions }] = await db
      .select({ totalSessions: count() })
      .from(sessions)
      .where(eq(sessions.courseId, courseId));

    const [{ completedSessions }] = await db
      .select({ completedSessions: count() })
      .from(sessionProgress)
      .innerJoin(sessions, eq(sessionProgress.sessionId, sessions.id))
      .where(
        and(
          eq(sessionProgress.userId, userId!),
          eq(sessionProgress.completed, true),
          eq(sessions.courseId, courseId)
        )
      );

    const progress =
      totalSessions > 0
        ? Math.round((completedSessions / totalSessions) * 100)
        : 0;

    res.status(200).json({
      totalSessions,
      completedSessions,
      progress,
    });
  } catch (error) {
    console.error("GetCourseProgress error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
