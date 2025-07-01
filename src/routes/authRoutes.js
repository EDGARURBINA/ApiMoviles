import { Router } from "express";
import * as authCtrl from "../controller/auth.Controller.js";
import { verifyToken, isAdmin } from "../middlewares/authJwt.js";
import { upload } from "../middlewares/upload.js";

const router = Router();

router.post("/signin",authCtrl.signin);
router.post("/signup", upload.single('image'), authCtrl.signup);
router.get("/users",verifyToken,authCtrl.getAllUsers);
router.delete("/users/:id",authCtrl.deleteUser);
router.put("/users/:id",verifyToken, upload.single('image'), authCtrl.updateUser);

export default router;