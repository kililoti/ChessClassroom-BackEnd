import { Request, Response } from 'express';
import { ClaseService } from '../services/clase.service';

export class ClaseController {
  
  static async crearClase(req: Request, res: Response): Promise<void> {
    try {
      const { profesorId, nombre, descripcion, tipo } = req.body;
      
      if (!profesorId || !nombre || !tipo) {
        res.status(400).json({ error: 'Faltan campos obligatorios (profesorId, nombre, tipo)' });
        return;
      }

      const nuevaClase = await ClaseService.crearClase(profesorId, nombre, descripcion, tipo);
      res.status(201).json(nuevaClase);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async infoInvitacion(req: Request, res: Response): Promise<void> {
    try {
      const codigo = req.params.codigo as string;
      
      const info = await ClaseService.obtenerInfoInvitacion(codigo);
      res.status(200).json(info);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }

  static async unirseAClase(req: Request, res: Response): Promise<void> {
    try {
      const { alumnoId, codigo } = req.body;
      
      if (!alumnoId || !codigo) {
        res.status(400).json({ error: 'Se requiere el ID del alumno y el código de invitación' });
        return;
      }

      const resultado = await ClaseService.unirseConCodigo(alumnoId, codigo);
      res.status(200).json(resultado);
    } catch (error: any) {
      // Si es un error de negocio (ya está inscrito, llena), devuelve un 400 Bad Request
      res.status(400).json({ error: error.message });
    }
  }

    static async alternarEstado(req: Request, res: Response): Promise<void> {
        try {
        const id = req.params.id as string;
        const { activo } = req.body;

        if (typeof activo !== 'boolean') {
            res.status(400).json({ error: 'El campo "activo" debe ser un booleano' });
            return;
        }

        const claseActualizada = await ClaseService.cambiarEstado(id, activo);
        res.status(200).json(claseActualizada);
        } catch (error: any) {
        res.status(500).json({ error: error.message });
        }
    }

    static async eliminarClase(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      
      const claseEliminada = await ClaseService.eliminarClase(id);
      
      // Devolver un 200 OK confirmando qué se ha borrado
      res.status(200).json({ 
        mensaje: 'Clase eliminada permanentemente', 
        clase: claseEliminada 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async listarClasesPorProfesor(req: Request, res: Response): Promise<void> {
    try {
      const profesorId = req.params.profesorId as string;
      const clases = await ClaseService.getClasesPorProfesor(profesorId);
      res.status(200).json(clases);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async listarClasesPorAlumno(req: Request, res: Response): Promise<void> {
    try {
      // Extraer el ID del alumno de los parámetros de la URL
      const alumnoId = req.params.alumnoId as string;
      
      const clases = await ClaseService.getClasesPorAlumno(alumnoId);
      res.status(200).json(clases);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async obtenerClase(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      
      const clase = await ClaseService.obtenerClasePorId(id);
      res.status(200).json(clase);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }

  static async listarAlumnosPorClase(req: Request, res: Response): Promise<void> {
  try {
    const claseId = req.params.claseId as string;
    const alumnos = await ClaseService.getAlumnosPorClase(claseId);
    res.status(200).json(alumnos);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

  static async listarMiembrosPorClase(req: Request, res: Response): Promise<void> {
    try {
      const claseId = req.params.claseId as string;
      const miembros = await ClaseService.getMiembrosPorClase(claseId);
      res.status(200).json({ miembros });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}