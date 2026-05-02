import { Router, type IRouter } from "express";
import healthRouter from "./health";
import enterprisesRouter from "./enterprises";
import storesRouter from "./stores";
import stationsRouter from "./stations";
import devicesRouter from "./devices";
import ordersRouter from "./orders";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(enterprisesRouter);
router.use(storesRouter);
router.use(stationsRouter);
router.use(devicesRouter);
router.use(ordersRouter);
router.use(dashboardRouter);

export default router;
