import express from 'express';
import cors from 'cors';
import authRoutes from "./routes/authRoutes.js";


const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);



export default app;
