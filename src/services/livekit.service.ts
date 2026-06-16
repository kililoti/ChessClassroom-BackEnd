import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

const roomService = new RoomServiceClient(
  process.env.LIVEKIT_URL!.replace('wss://', 'https://'),
  process.env.LIVEKIT_API_KEY!,
  process.env.LIVEKIT_API_SECRET!
);

export const generarTokenLiveKit = async (
  aulaId: string,
  usuarioId: string,
  nombreUsuario: string,
  esProfesor: boolean
) => {
  const token = new AccessToken(
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
    {
      identity: usuarioId,
      name: nombreUsuario,
    }
  );

  token.addGrant({
    roomJoin: true,
    room: `aula-${aulaId}`,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: esProfesor,
  });

  return token.toJwt();
};

export const mutearParticipante = async (aulaId: string, participanteId: string, muted: boolean) => {
  const participantes = await roomService.listParticipants(`aula-${aulaId}`);
  const participante = participantes.find(p => p.identity === participanteId);
  if (!participante) throw new Error('Participante no encontrado en la sala');

  const trackSid = participante.tracks.find(t => t.type === 0)?.sid;
  if (!trackSid) throw new Error('El participante no tiene track de audio activo');

  await roomService.mutePublishedTrack(`aula-${aulaId}`, participanteId, trackSid, muted);
};

export const expulsarParticipante = async (aulaId: string, participanteId: string) => {
  await roomService.removeParticipant(`aula-${aulaId}`, participanteId);
};