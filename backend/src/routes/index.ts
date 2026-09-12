import { Router } from "express";
import auth from "./auth";
import clients from "./clients";
import projects from "./projects";
import tasks from "./tasks";
import activity from "./activity";
import notifications from "./notifications";
import dashboard from "./dashboard";
import users from "./users";

const router = Router();

router.use("/auth", auth);
router.use("/clients", clients);
router.use("/projects", projects);
router.use("/tasks", tasks);
router.use("/activity", activity);
router.use("/notifications", notifications);
router.use("/dashboard", dashboard);
router.use("/users", users);

export default router;
