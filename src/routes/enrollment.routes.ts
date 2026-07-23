import { Router } from "express";
import {
  enrollInCourse,
  getMyEnrollments,
  getAllEnrollments,
} from "../controllers/enrollment.controller";
import { authenticate, authorize } from "../middleware";

const router = Router();

router.get("/my", authenticate, getMyEnrollments);
router.get("/", authenticate, authorize("admin"), getAllEnrollments);
router.post("/", authenticate, authorize("admin"), enrollInCourse);

export default router;
