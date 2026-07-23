import { Request, Response } from "express";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import { AuthRequest } from "../middleware/auth";

export const getProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.userId;

    const user = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        avatar: users.avatar,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId!))
      .limit(1);

    if (user.length === 0) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json({ user: user[0] });
  } catch (error) {
    console.error("GetProfile error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.userId;
    const { name, avatar } = req.body;

    const updated = await db
      .update(users)
      .set({ name, avatar, updatedAt: new Date() })
      .where(eq(users.id, userId!))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        avatar: users.avatar,
      });

    if (updated.length === 0) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json({ user: updated[0] });
  } catch (error) {
    console.error("UpdateProfile error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const changePassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: "Current and new password are required" });
      return;
    }

    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId!))
      .limit(1);

    if (user.length === 0) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user[0].password
    );

    if (!isPasswordValid) {
      res.status(401).json({ message: "Current password is incorrect" });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db
      .update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, userId!));

    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("ChangePassword error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
