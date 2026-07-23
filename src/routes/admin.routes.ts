import { Router } from "express";
import {
  getDashboardStats,
  getAllStudents,
} from "../controllers/admin.controller";
import { authenticate, authorize } from "../middleware";

const router = Router();

router.get("/dashboard", authenticate, authorize("admin"), getDashboardStats);
router.get("/students", authenticate, authorize("admin"), getAllStudents);

export default router;
