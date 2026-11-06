import { WebSocketServer, WebSocket } from 'ws';
import { db } from '../db.js';
import { hashToken } from '../auth.js';

// Map of userId -> Set of active WebSocket connections
const userSockets = new Map<string, Set<WebSocket>>();

let wssInstance: WebSocketServer | null = null;

export function initWebSocketServer(server: any) {
  const wss = new WebSocketServer({ noServer: true });
  wssInstance = wss;

  server.on('upgrade', (request: any, socket: any, head: any) => {
    try {
      const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
      if (url.pathname === '/ws') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    } catch (e) {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket, req: any) => {
    let authenticatedUserId: string | null = null;

    try {
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const token = url.searchParams.get('token') || (req.headers['sec-websocket-protocol'] as string);

      if (token) {
        const tokenHash = hashToken(token.trim());
        const session = db.prepare(`
          SELECT user_id, expires_at FROM sessions WHERE token_hash = ?
        `).get(tokenHash) as any;

        if (session && new Date(session.expires_at).getTime() > Date.now()) {
          const uid = String(session.user_id);
          authenticatedUserId = uid;
          if (!userSockets.has(uid)) {
            userSockets.set(uid, new Set());
          }
          userSockets.get(uid)!.add(ws);

          // Send connection ACK with unread count
          const unreadCount = (db.prepare(`
            SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0
          `).get(uid) as any)?.c || 0;

          ws.send(JSON.stringify({
            type: 'CONNECTED',
            userId: uid,
            unreadCount,
            message: 'Connected to LHSE Real-Time Notification Service',
          }));
        }
      }
    } catch (e) {
      console.error('[WebSocket Auth Error]', e);
    }

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(String(message));
        if (data.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
        } else if (data.type === 'AUTH' && data.token) {
          const tokenHash = hashToken(String(data.token).trim());
          const session = db.prepare(`
            SELECT user_id, expires_at FROM sessions WHERE token_hash = ?
          `).get(tokenHash) as any;

          if (session && new Date(session.expires_at).getTime() > Date.now()) {
            const uid = String(session.user_id);
            authenticatedUserId = uid;
            if (!userSockets.has(uid)) {
              userSockets.set(uid, new Set());
            }
            userSockets.get(uid)!.add(ws);

            const unreadCount = (db.prepare(`
              SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0
            `).get(uid) as any)?.c || 0;

            ws.send(JSON.stringify({
              type: 'AUTHENTICATED',
              userId: uid,
              unreadCount,
            }));
          }
        }
      } catch (err) {}
    });

    ws.on('close', () => {
      if (authenticatedUserId && userSockets.has(authenticatedUserId)) {
        userSockets.get(authenticatedUserId)!.delete(ws);
        if (userSockets.get(authenticatedUserId)!.size === 0) {
          userSockets.delete(authenticatedUserId);
        }
      }
    });

    ws.on('error', () => {
      if (authenticatedUserId && userSockets.has(authenticatedUserId)) {
        userSockets.get(authenticatedUserId)!.delete(ws);
      }
    });
  });

  console.log('[Smart E-Doc-LHSE] Real-Time WebSocket Notification Service initialized on /ws');
  return wss;
}

/**
 * Persist notification to database and broadcast to recipient's active WebSocket sessions
 */
export function sendRealTimeNotification(
  userId: string,
  titleLo: string,
  titleEn: string,
  messageLo: string,
  messageEn: string,
  type: 'INFO' | 'APPROVAL_REQUEST' | 'DOCUMENT_APPROVED' | 'DOCUMENT_REJECTED' | 'REVISION_REQUESTED' | 'DEADLINE_ALERT' | 'SIGNATURE_COMPLETED',
  entityId: string
) {
  const notifId = `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // 1. Insert into D1 / SQLite database
  try {
    db.prepare(`
      INSERT INTO notifications (id, user_id, title_lo, title_en, message_lo, message_en, type, entity_type, entity_id, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'DOCUMENT', ?, 0, CURRENT_TIMESTAMP)
    `).run(notifId, userId, titleLo, titleEn, messageLo, messageEn, type, entityId);
  } catch (err) {
    console.error('[Notification DB Error]', err);
  }

  // 2. Broadcast via WebSocket if user is currently online
  const payload = JSON.stringify({
    type: 'NOTIFICATION_RECEIVED',
    notification: {
      id: notifId,
      user_id: userId,
      title_lo: titleLo,
      title_en: titleEn,
      message_lo: messageLo,
      message_en: messageEn,
      type,
      entity_type: 'DOCUMENT',
      entity_id: entityId,
      is_read: 0,
      created_at: new Date().toISOString(),
    },
  });

  const sockets = userSockets.get(userId);
  if (sockets && sockets.size > 0) {
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  return notifId;
}
