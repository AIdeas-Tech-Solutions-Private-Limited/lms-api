import { Request, Response } from "express";
import { db } from "../db";
import { users, courses, enrollments, sessions } from "../db/schema";
import { count, eq } from "drizzle-orm";

export const getDashboardStats = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const [{ totalCourses }] = await db
      .select({ totalCourses: count() })
      .from(courses);

    const [{ totalStudents }] = await db
      .select({ totalStudents: count() })
      .from(users)
      .where(eq(users.role, "student"));

    const [{ totalEnrollments }] = await db
      .select({ totalEnrollments: count() })
      .from(enrollments);

    const [{ totalSessions }] = await db
      .select({ totalSessions: count() })
      .from(sessions);

    res.status(200).json({
      totalCourses,
      totalStudents,
      totalEnrollments,
      totalSessions,
    });
  } catch (error) {
    console.error("GetDashboardStats error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllStudents = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const students = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.role, "student"));

    const studentsWithEnrollments = await Promise.all(
      students.map(async (student) => {
        const [{ enrollmentCount }] = await db
          .select({ enrollmentCount: count() })
          .from(enrollments)
          .where(eq(enrollments.userId, student.id));

        return { ...student, enrollmentCount };
      })
    );

    res.status(200).json({ students: studentsWithEnrollments });
  } catch (error) {
    console.error("GetAllStudents error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
