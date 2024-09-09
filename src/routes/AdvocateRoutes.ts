import { Router } from "express";
import AdvocateController from "../controllers/AdvocateController.js";

const advocateRouter: Router = Router();

advocateRouter.get('/', AdvocateController.getAllAdvocates);

export default advocateRouter;