import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { db } from "../db";
import { enrollments, courses, categories, sessions, sessionProgress, users } from "../db/schema";
import { eq, and, count } from "drizzle-orm";
import { AuthRequest } from "../middleware/auth";

export const enrollInCourse = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, courseId } = req.body;

    if (!email || !courseId) {
      res.status(400).json({ message: "email and courseId are required" });
      return;
    }

    const course = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (course.length === 0) {
      res.status(404).json({ message: "Course not found" });
      return;
    }

    let student = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (student.length === 0) {
      const hashedPassword = await bcrypt.hash("student123", 10);
      const nameFromEmail = email.split("@")[0];
      const newStudent = await db
        .insert(users)
        .values({
          name: nameFromEmail,
          email,
          password: hashedPassword,
          role: "student",
        })
        .returning({ id: users.id, name: users.name, email: users.email });
      student = [{ id: newStudent[0].id, name: newStudent[0].name, email: newStudent[0].email, password: "", avatar: null, role: "student" as const, createdAt: new Date(), updatedAt: new Date() }];
    }

    const userId = student[0].id;

    const existingEnrollment = await db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)))
      .limit(1);

    if (existingEnrollment.length > 0) {
      res.status(409).json({ message: "Student already enrolled in this course" });
      return;
    }

    const newEnrollment = await db
      .insert(enrollments)
      .values({ userId, courseId })
      .returning();

    res.status(201).json({
      enrollment: newEnrollment[0],
      student: { id: student[0].id, name: student[0].name, email: student[0].email },
    });
  } catch (error) {
    console.error("EnrollInCourse error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getMyEnrollments = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.userId;

    const myEnrollments = await db
      .select({
        id: enrollments.id,
        courseId: enrollments.courseId,
        createdAt: enrollments.createdAt,
        courseTitle: courses.title,
        courseSlug: courses.slug,
        courseThumbnail: courses.thumbnail,
        courseLevel: courses.level,
        categoryName: categories.name,
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .where(eq(enrollments.userId, userId!));

    const enrollmentsWithProgress = await Promise.all(
      myEnrollments.map(async (enrollment) => {
        const [{ totalSessions }] = await db
          .select({ totalSessions: count() })
          .from(sessions)
          .where(eq(sessions.courseId, enrollment.courseId));

        const [{ completedSessions }] = await db
          .select({ completedSessions: count() })
          .from(sessionProgress)
          .innerJoin(sessions, eq(sessionProgress.sessionId, sessions.id))
          .where(
            and(
              eq(sessionProgress.userId, userId!),
              eq(sessionProgress.completed, true),
              eq(sessions.courseId, enrollment.courseId)
            )
          );

        const progress =
          totalSessions > 0
            ? Math.round((completedSessions / totalSessions) * 100)
            : 0;

        return {
          ...enrollment,
          totalSessions,
          completedSessions,
          progress,
        };
      })
    );

    res.status(200).json({ enrollments: enrollmentsWithProgress });
  } catch (error) {
    console.error("GetMyEnrollments error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllEnrollments = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const allEnrollments = await db
      .select({
        id: enrollments.id,
        userId: enrollments.userId,
        courseId: enrollments.courseId,
        createdAt: enrollments.createdAt,
        userName: users.name,
        userEmail: users.email,
        courseTitle: courses.title,
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .innerJoin(users, eq(enrollments.userId, users.id));

    res.status(200).json({ enrollments: allEnrollments });
  } catch (error) {
    console.error("GetAllEnrollments error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
