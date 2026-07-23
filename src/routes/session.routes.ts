import { Router } from "express";
import {
  createSession,
  getSessionsByCourse,
  getSessionById,
  updateSession,
  deleteSession,
} from "../controllers/session.controller";
import { authenticate, authorize } from "../middleware";

const router = Router();

router.get("/course/:courseId", getSessionsByCourse);
router.get("/:id", getSessionById);
router.post("/", authenticate, authorize("admin"), createSession);
router.put("/:id", authenticate, authorize("admin"), updateSession);
router.delete("/:id", authenticate, authorize("admin"), deleteSession);

export default router;
