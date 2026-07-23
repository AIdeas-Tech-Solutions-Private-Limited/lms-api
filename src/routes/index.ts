import { Router } from "express";
import authRoutes from "./auth.routes";
import categoryRoutes from "./category.routes";
import courseRoutes from "./course.routes";
import sessionRoutes from "./session.routes";
import enrollmentRoutes from "./enrollment.routes";
import progressRoutes from "./progress.routes";
import profileRoutes from "./profile.routes";
import adminRoutes from "./admin.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/categories", categoryRoutes);
router.use("/courses", courseRoutes);
router.use("/sessions", sessionRoutes);
router.use("/enrollments", enrollmentRoutes);
router.use("/progress", progressRoutes);
router.use("/profile", profileRoutes);
router.use("/admin", adminRoutes);

export default router;
