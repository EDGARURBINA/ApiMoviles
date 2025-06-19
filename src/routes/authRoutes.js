import { Router } from "express";
import * as authCtrl from "../controller/auth.Controller.js";
import { verifyToken, isAdmin } from "../middlewares/authJwt.js";


const router = Router();

router.post("/signin", verifyToken, authCtrl.signin);
router.post("/signup", authCtrl.signup);
router.get("/users", authCtrl.getAllUsers)
router.delete("/users/:id", authCtrl.deleteUser)
router.put("/users/:id", authCtrl.updateUser)


export default router;
