import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();
import authRoutes from './routes/auth.routes';

const app = express();
const PORT = process.env.PORT || 3001;

// 2. Configurar CORS (Le damos permiso a frontend en el puerto 3000)
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());
app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
});