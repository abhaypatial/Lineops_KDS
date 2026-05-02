import { Router, type IRouter } from "express";
import healthRouter       from "./health";
import enterprisesRouter  from "./enterprises";
import storesRouter       from "./stores";
import stationsRouter     from "./stations";
import devicesRouter      from "./devices";
import ordersRouter       from "./orders";
import dashboardRouter    from "./dashboard";
import keysRouter         from "./keys";
import webhooksRouter     from "./webhooks";
import integrationsRouter from "./integrations";
import testRouter         from "./test";

const router: IRouter = Router();

router.use(healthRouter);
router.use(enterprisesRouter);
router.use(storesRouter);
router.use(stationsRouter);
router.use(devicesRouter);
router.use(ordersRouter);
router.use(dashboardRouter);
router.use(keysRouter);
router.use(webhooksRouter);
router.use(integrationsRouter);
router.use(testRouter);

export default router;
