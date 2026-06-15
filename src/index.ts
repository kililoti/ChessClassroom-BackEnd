import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();
import authRoutes from './routes/auth.routes';
import claseRoutes from './routes/clase.routes';
import chatRoutes from './routes/chat.routes';
import recursosRoutes from './routes/recursos.routes';
import chatIARoutes from './routes/chatbot.routes';
import materialesRoutes from './routes/materiales.routes';

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
app.use('/api/chats', chatRoutes);
app.use('/api/recursos', recursosRoutes);
app.use('/api/chat-ia', chatIARoutes);
app.use('/api/materiales', materialesRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
});