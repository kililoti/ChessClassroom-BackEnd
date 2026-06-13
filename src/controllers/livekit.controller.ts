import { Request, Response } from 'express';
import { generarTokenLiveKit, mutearParticipante, expulsarParticipante } from '../services/livekit.service';
import { supabaseAdmin } from '../config/supabase';

export const obtenerTokenLiveKit = async (req: Request, res: Response) => {
  try {
    const { aulaId } = req.params as { aulaId: string };
    const usuario = (req as any).usuario;

    const { data } = await supabaseAdmin
      .from('clase_profesores')
      .select('profesor_id')
      .eq('profesor_id', usuario.id)
      .single();

    const esProfesor = !!data;

    const token = await generarTokenLiveKit(
      aulaId,
      usuario.id,
      `${usuario.nombre} ${usuario.apellidos}`,
      esProfesor
    );

    res.json({ token, serverUrl: process.env.LIVEKIT_URL });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const mutearAlumno = async (req: Request, res: Response) => {
  try {
    const { aulaId, participanteId } = req.params as { aulaId: string; participanteId: string };
    const { muted } = req.body;
    await mutearParticipante(aulaId, participanteId, muted ?? true);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const expulsarAlumno = async (req: Request, res: Response) => {
  try {
    const { aulaId, participanteId } = req.params as { aulaId: string; participanteId: string };
    await expulsarParticipante(aulaId, participanteId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};