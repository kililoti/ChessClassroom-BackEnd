import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();
import authRoutes from './routes/auth.routes';
import claseRoutes from './routes/clase.routes';

const app = express();
const PORT = process.env.PORT || 3001;

// Configurar CORS (Dar permiso a frontend en el puerto 3000)
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true
}));

app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/clases', claseRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
});