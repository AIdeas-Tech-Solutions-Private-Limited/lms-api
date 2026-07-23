import { Router } from "express";
import {
  createCourse,
  getCourses,
  getCoursesAdmin,
  getCourseBySlug,
  getCourseById,
  updateCourse,
  deleteCourse,
  getFeaturedCourses,
} from "../controllers/course.controller";
import { authenticate, authorize } from "../middleware";

const router = Router();

router.get("/", getCourses);
router.get("/admin/all", authenticate, authorize("admin"), getCoursesAdmin);
router.get("/featured", getFeaturedCourses);
router.get("/slug/:slug", getCourseBySlug);
router.get("/:id", getCourseById);
router.post("/", authenticate, authorize("admin"), createCourse);
router.put("/:id", authenticate, authorize("admin"), updateCourse);
router.delete("/:id", authenticate, authorize("admin"), deleteCourse);

export default router;
