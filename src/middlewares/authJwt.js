import jwt from "jsonwebtoken";
import config from "../config.js";
import User from "../models/User.js";

export const verifyToken = async (req, res, next) => {
  const token = req.headers["token"];

  if (typeof token !== "string") {
    res.status(403).json({ message: "Token should be a string" });
    return;
  }

  if (!token) {
    res.status(403).json({ message: "No token provided" });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.SECRET);

    req.userId = decoded.id;
    const user = await User.findById(req.userId, { password: 0 });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
  }
};

export const isAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).populate("roles");

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const hasAdminRole = user.roles.some(role => role.name === "Admin");

    if (hasAdminRole) {
      next();
      return;
    }

    res.status(403).json({ message: "Require Admin Role" });
  } catch (error) {
    console.error("Error in isAdmin middleware:", error);
    res.status(500).json({ message: "Error en la validación del rol" });
  }
};
