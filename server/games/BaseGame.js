export default class BaseGame {
    constructor(room, io) {
        this.room = room;
        this.io = io;
    }

    // Called when a player joins logic (after room addition)
    onPlayerJoin(player) {
        // Default implementation: just log or do nothing
    }

    // Called when a player leaves
    onPlayerLeave(player) {
        // Default implementation
    }

    // Handle generic game events forwarded from index.js
    handleEvent(eventName, payload, socket) {
        // Override this in subclasses to handle specific events
        // e.g. if (eventName === 'attack') ...
    }

    // Called when game actually starts (after countdown)
    onStart(seed) {
        this.io.to(this.room.id).emit('game-started', seed);
    }

    // Helper to broadcast to room
    broadcast(event, data) {
        this.io.to(this.room.id).emit(event, data);
    }
}
