import { Router, type IRouter } from "express";
import healthRouter from "./health";
import iamRouter from "./iam";

const router: IRouter = Router();

router.use(healthRouter);
router.use(iamRouter);

export default router;
