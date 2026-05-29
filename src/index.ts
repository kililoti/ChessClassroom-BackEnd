import express from 'express';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';

// 1. Cargar el .env PRIMERO
dotenv.config();
console.log("Comprobando inicio del servidor...");



const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
});