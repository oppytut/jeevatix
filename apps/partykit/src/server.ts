import type * as Party from 'partykit/server';

type AvailabilityItem = {
  tierId: string;
  remaining: number;
};

type AvailabilityMessage = {
  type: 'availability';
  data: AvailabilityItem[];
};

const LATEST_AVAILABILITY_KEY = 'latest-availability';

function jsonError(message: string, status: number) {
  return Response.json(
    {
      ok: false,
      error: message,
    },
    { status },
  );
}

function isAvailabilityMessage(value: unknown): value is AvailabilityMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<AvailabilityMessage>;

  return (
    candidate.type === 'availability' &&
    Array.isArray(candidate.data) &&
    candidate.data.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof (item as AvailabilityItem).tierId === 'string' &&
        Number.isFinite((item as AvailabilityItem).remaining),
    )
  );
}

function getSecret(env: Record<string, unknown>) {
  const secret = env.PARTY_SECRET;

  return typeof secret === 'string' && secret.length > 0 ? secret : null;
}

export default class Server implements Party.Server {
  constructor(readonly room: Party.Room) {}

  private async getLatestAvailability() {
    const payload = await this.room.storage.get<AvailabilityMessage>(LATEST_AVAILABILITY_KEY);

    return isAvailabilityMessage(payload) ? payload : null;
  }

  private async broadcastAvailability(data: AvailabilityItem[]) {
    const payload: AvailabilityMessage = {
      type: 'availability',
      data,
    };

    await this.room.storage.put(LATEST_AVAILABILITY_KEY, payload);
    this.room.broadcast(JSON.stringify(payload));

    return payload;
  }

  async onConnect(connection: Party.Connection) {
    const latestAvailability = await this.getLatestAvailability();

    if (!latestAvailability) {
      return;
    }

    connection.send(JSON.stringify(latestAvailability));
  }

  async onMessage(message: string | ArrayBuffer | ArrayBufferView, sender: Party.Connection) {
    void message;

    sender.send(
      JSON.stringify({
        ok: false,
        error: 'Client websocket messages are not accepted for availability updates.',
      }),
    );
  }

  async onRequest(req: Party.Request) {
    if (req.method === 'GET') {
      const latestAvailability = await this.getLatestAvailability();

      return Response.json({
        ok: true,
        room_id: this.room.id,
        data: latestAvailability?.data ?? [],
      });
    }

    if (req.method !== 'POST') {
      return jsonError('Method not allowed.', 405);
    }

    const configuredSecret = getSecret(this.room.env);

    if (!configuredSecret) {
      return jsonError('PARTY_SECRET is not configured.', 500);
    }

    const providedSecret = req.headers.get('x-party-secret');

    if (providedSecret !== configuredSecret) {
      return jsonError('Invalid party secret.', 401);
    }

    let payload: unknown;

    try {
      payload = await req.json();
    } catch {
      return jsonError('Request body must be valid JSON.', 400);
    }

    if (!isAvailabilityMessage(payload)) {
      return jsonError('Unsupported realtime payload.', 400);
    }

    const broadcast = await this.broadcastAvailability(payload.data);

    return Response.json({
      ok: true,
      room_id: this.room.id,
      data: broadcast.data,
    });
  }
}

Server satisfies Party.Worker;
