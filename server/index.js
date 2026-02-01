import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import Room from './Room.js';

const app = express();
app.use(cors());
const server = createServer(app);

const generateName = () => `Player ${Math.random().toString(36).substring(2, 4).toUpperCase()}`;

// 設定 Socket.io
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "https://math-io-frontend.vercel.app"], // 允許任何網址連線
    methods: ["GET", "POST"]
  }
});

const rooms = {};

// 產生短 ID 工具
const generateRoomId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

io.on('connection', (socket) => {
  console.log('一位玩家連線了！ ID:', socket.id);

  // 取得房間列表 (只回傳公開且未額滿的)
  socket.on('get-rooms', () => {
    const publicRooms = Object.values(rooms)
      .filter(r => !r.isPrivate && r.players.length < r.maxPlayers)
      .map(r => ({
        id: r.id,
        name: r.name,
        players: r.players,
        maxPlayers: r.maxPlayers,
        gameId: r.gameId,
        mode: r.mode,
        status: r.status
      }));
    socket.emit('room-list', publicRooms);
    socket.emit('room-list', publicRooms);
  });

  // Time Sync
  socket.on('sync-time', (clientSendTime) => {
    socket.emit('sync-time-response', {
      serverTime: Date.now(),
      clientSendTime
    });
  });

  // 建立房間 (Deprecate: join-room handles creation now usually, but keeping for compatibility)
  socket.on('create-room', ({ name, isPrivate, maxPlayers, gameId, mode, duration, options }) => {
    const roomId = generateRoomId();
    const newRoom = new Room(roomId, name || `Room ${roomId}`, isPrivate, maxPlayers || 8, gameId || 'fruitbox', mode || 'classic', io, duration, options);
    rooms[roomId] = newRoom;

    socket.emit('room-created', roomId);
    broadcastRoomList();
  });

  // 加入房間
  socket.on('join-room', (data) => {
    let roomId, playerName, gameId, mode, duration, options;

    if (typeof data === 'object') {
      roomId = data.roomId;
      playerName = data.name;
      gameId = data.gameId;
      mode = data.mode;
      duration = data.duration;
      options = data.options;
      console.log('玩家加入房間:', roomId, '玩家名稱:', playerName);
    }
    else {
      roomId = data;
      playerName = null;
    }

    const room = rooms[roomId];

    if (!room) {
      // Auto-Create if joining non-existent room? 
      // The previous code returned error: `if (!room) { socket.emit('error', '房間不存在'); return; }`
      // But the user might expect auto-creation for specific URLs.
      // Let's SUPPORT auto-creation if gameId is provided, otherwise Error.
      if (gameId) {
        console.log('Room not found, Auto-Creating:', roomId);
        const newRoom = new Room(roomId, `Room ${roomId}`, false, 8, gameId || 'fruitbox', mode || 'classic', io, duration, options);
        rooms[roomId] = newRoom;
        // Continue to join...
      } else {
        socket.emit('error', '房間不存在'); return;
      }
    }

    // Refresh ref in case we just created it
    const targetRoom = rooms[roomId];

    // Check if room is full
    if (targetRoom.players.length >= targetRoom.maxPlayers) { socket.emit('error', '房間已滿'); return; }

    // Check if game has started - ALLOWED now (Late Join -> Wait in Lobby)
    // if (room.status !== 'waiting') { socket.emit('error', '遊戲已開始，無法加入'); return; }

    socket.join(roomId);

    // Color Palette
    const PLAY_COLORS = [
      '#ef4444', // Red 500
      '#3b82f6', // Blue 500
      '#10b981', // Emerald 500
      '#f59e0b', // Amber 500
      '#8b5cf6', // Violet 500
      '#ec4899', // Pink 500
      '#06b6d4', // Cyan 500
      '#84cc16', // Lime 500
    ];

    // Check existing players to pick unused color if possible, or cycle
    const takenColors = new Set(targetRoom.players.map(p => p.color));
    const availableColor = PLAY_COLORS.find(c => !takenColors.has(c)) || PLAY_COLORS[targetRoom.players.length % PLAY_COLORS.length];

    // 新增玩家物件
    const newPlayer = {
      id: socket.id,
      name: playerName || generateName(),
      score: 0,
      isReady: false,
      color: availableColor,
      isEliminated: false
    };

    targetRoom.addPlayer(newPlayer);

    // Sync full room state to the new player
    socket.emit('room-state', {
      mode: targetRoom.mode,
      hostId: targetRoom.hostId,
      status: targetRoom.status,
      duration: targetRoom.duration,
      options: targetRoom.options,
      startTime: targetRoom.startTime,
      seed: targetRoom.seed
    });

    io.to(roomId).emit('update-players', targetRoom.players);
    broadcastRoomList();
  });

  // --- Lobby Features (Delegated to Room or Handled here) ---

  // Update Game Mode (Host Only)
  socket.on('update-mode', ({ roomId, mode }) => {
    const room = rooms[roomId];
    if (room && room.hostId === socket.id) {
      room.mode = mode;
      io.to(roomId).emit('mode-updated', mode);
    }
  });

  // Update Duration (Host Only)
  socket.on('update-duration', ({ roomId, duration }) => {
    const room = rooms[roomId];
    if (room && room.hostId === socket.id) {
      room.duration = duration;
      io.to(roomId).emit('duration-updated', duration);
    }
  });

  // Update Generic Options (Host Only)
  socket.on('update-options', ({ roomId, options }) => {
    const room = rooms[roomId];
    if (room && room.hostId === socket.id) {
      room.options = { ...room.options, ...options };
      io.to(roomId).emit('options-updated', room.options);
    }
  });

  // Toggle Ready Status
  socket.on('toggle-ready', (roomId) => {
    const room = rooms[roomId];
    if (room) {
      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        player.isReady = !player.isReady;
        io.to(roomId).emit('update-players', room.players);
      }
    }
  });

  // Transfer Host (Host Only)
  socket.on('transfer-host', ({ roomId, newHostId }) => {
    const room = rooms[roomId];
    if (room && room.hostId === socket.id) {
      // Verify new host is in room
      if (room.players.find(p => p.id === newHostId)) {
        room.hostId = newHostId;
        io.to(roomId).emit('host-updated', newHostId);
      }
    }
  });

  // Start Countdown (Host Only)
  socket.on('start-countdown', (roomId) => {
    const room = rooms[roomId];
    if (room && room.hostId === socket.id && room.status === 'waiting') {
      const allReady = room.players.every(p => p.isReady || p.id === room.hostId);

      if (allReady) {
        room.status = 'countdown';
        io.to(roomId).emit('countdown-start', 3);

        setTimeout(() => {
          if (rooms[roomId]) {
            rooms[roomId].startGame();
            broadcastRoomList();
          }
        }, 3000);
      }
    }
  });

  // --- Game Specific Events (Delegated) ---
  const GAME_EVENTS = ['update-score', 'game-attack', 'game-board-sync', 'game-occupy', 'sudoku-move', 'game-finished', 'player-eliminated'];

  GAME_EVENTS.forEach(event => {
    socket.on(event, (payload) => {
      // Payload usually contains roomId, or we infer it?
      // The current client sends { roomId, ... }
      const roomId = payload.roomId;
      const room = rooms[roomId];
      if (room && room.gameInstance) {
        room.gameInstance.handleEvent(event, payload, socket);
      }
    });
  });

  // Reset Room
  socket.on('reset-room', (roomId) => {
    const room = rooms[roomId];
    if (room && room.hostId === socket.id) {
      room.status = 'waiting';
      room.players.forEach(p => p.isReady = false);
      room.startTime = null;

      io.to(roomId).emit('room-state', {
        mode: room.mode,
        hostId: room.hostId,
        status: room.status,
        duration: room.duration,
        startTime: null
      });
      io.to(roomId).emit('update-players', room.players);
      broadcastRoomList();
    }
  });

  //  斷線
  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const removed = room.removePlayer(socket.id);

      if (removed) {
        if (room.isEmpty()) {
          delete rooms[roomId];
        } else {
          io.to(roomId).emit('update-players', room.players);
        }
        broadcastRoomList();
        break;
      }
    }
  });
});

function broadcastRoomList() {
  io.emit('room-list', Object.values(rooms)
    .filter(r => !r.isPrivate)
    .map(r => ({
      id: r.id,
      name: r.name,
      players: r.players,
      maxPlayers: r.maxPlayers,
      gameId: r.gameId,
      mode: r.mode,
      status: r.status
    }))
  );
}

// 啟動伺服器在 Port 3000
server.listen(3000, () => {
  console.log('🚀 後端伺服器已啟動: http://localhost:3000');
});