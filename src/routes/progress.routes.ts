import { Router } from "express";
import {
  markSessionComplete,
  getSessionProgress,
  getCourseProgress,
} from "../controllers/progress.controller";
import { authenticate } from "../middleware";

const router = Router();

router.post("/:sessionId/complete", authenticate, markSessionComplete);
router.get("/:sessionId", authenticate, getSessionProgress);
router.get("/course/:courseId", authenticate, getCourseProgress);

export default router;
