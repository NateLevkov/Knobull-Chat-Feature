import express from 'express';
import http from 'http';
import { Server as socketio } from "socket.io";

// Store users and their rooms
const users = new Map(); // socket.id -> { username, rooms: Set() }
const rooms = new Map(); // roomName -> { users: Set(), messages: [] }

const app = express();
const server = http.createServer(app);

// Create socket.io server
const io = new socketio(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// Helper function to get room list for a user
const getUserRooms = (socketId) => {
    const user = users.get(socketId);
    if (!user) return [];
    return Array.from(user.rooms);
};

// Helper function to get room info with unread counts
const getRoomInfo = (socketId) => {
    const user = users.get(socketId);
    if (!user) return [];
    
    return Array.from(user.rooms).map(roomName => {
        const room = rooms.get(roomName);
        return {
            name: roomName,
            userCount: room ? room.users.size : 0,
            lastMessage: room && room.messages.length > 0 ? room.messages[room.messages.length - 1] : null
        };
    });
};

io.on('connection', (socket) => {
    console.log("User has connected:", socket.id);

    // Set username event
    socket.on('setUsername', (username) => {
        users.set(socket.id, { username, rooms: new Set() });
        console.log(`Username set: ${username} for socket ${socket.id}`);
        
        // Send current room list (empty initially)
        socket.emit('roomList', getRoomInfo(socket.id));
    });

    // Join room event
    socket.on('joinRoom', (roomName) => {
        const user = users.get(socket.id);
        if (!user || !roomName) return;

        // Initialize room if it doesn't exist
        if (!rooms.has(roomName)) {
            rooms.set(roomName, { users: new Set(), messages: [] });
        }

        const room = rooms.get(roomName);
        
        // Add user to room if not already there
        if (!user.rooms.has(roomName)) {
            user.rooms.add(roomName);
            room.users.add(socket.id);
            socket.join(roomName);

            console.log(`${user.username} joined room ${roomName}`);

            // Create join message
            const joinMessage = {
                user: 'admin',
                text: `${user.username} has joined the room!`,
                timestamp: new Date().toISOString(),
                room: roomName
            };

            // Add to room history
            room.messages.push(joinMessage);

            // Broadcast join message to room
            io.to(roomName).emit('message', joinMessage);

            // Send room history to the joining user
            socket.emit('roomHistory', { room: roomName, messages: room.messages });
        }

        // Send updated room list to user
        socket.emit('roomList', getRoomInfo(socket.id));
        
        // Send user list for the room
        const roomUsers = Array.from(room.users).map(socketId => users.get(socketId)?.username).filter(Boolean);
        io.to(roomName).emit('roomUsers', { room: roomName, users: roomUsers });
    });

    // Leave room event
    socket.on('leaveRoom', (roomName) => {
        const user = users.get(socket.id);
        if (!user || !user.rooms.has(roomName)) return;

        const room = rooms.get(roomName);
        if (room) {
            // Remove user from room
            user.rooms.delete(roomName);
            room.users.delete(socket.id);
            socket.leave(roomName);

            console.log(`${user.username} left room ${roomName}`);

            // Create leave message
            const leaveMessage = {
                user: 'admin',
                text: `${user.username} has left the room.`,
                timestamp: new Date().toISOString(),
                room: roomName
            };

            // Add to room history
            room.messages.push(leaveMessage);

            // Broadcast leave message to room
            io.to(roomName).emit('message', leaveMessage);

            // Send updated user list for the room
            const roomUsers = Array.from(room.users).map(socketId => users.get(socketId)?.username).filter(Boolean);
            io.to(roomName).emit('roomUsers', { room: roomName, users: roomUsers });

            // Clean up empty room
            if (room.users.size === 0) {
                rooms.delete(roomName);
                console.log(`Room ${roomName} deleted (empty)`);
            }
        }

        // Send updated room list to user
        socket.emit('roomList', getRoomInfo(socket.id));
    });

    // Send message event
    socket.on('sendMessage', ({ room, message }) => {
        const user = users.get(socket.id);
        if (!user || !user.rooms.has(room)) return;

        const roomData = rooms.get(room);
        if (roomData) {
            const messageData = {
                user: user.username,
                text: message,
                timestamp: new Date().toISOString(),
                room: room
            };

            // Add to room history
            roomData.messages.push(messageData);

            // Broadcast message to room
            io.to(room).emit('message', messageData);

            console.log(`Message in ${room} from ${user.username}: ${message}`);
        }
    });

    // Get room list event
    socket.on('getRoomList', () => {
        socket.emit('roomList', getRoomInfo(socket.id));
    });

    // Disconnect event
    socket.on('disconnect', () => {
        const user = users.get(socket.id);

        if (user) {
            console.log(`${user.username} disconnected`);

            // Remove user from all rooms
            user.rooms.forEach(roomName => {
                const room = rooms.get(roomName);
                if (room) {
                    room.users.delete(socket.id);

                    // Create leave message
                    const leaveMessage = {
                        user: 'admin',
                        text: `${user.username} has left the room.`,
                        timestamp: new Date().toISOString(),
                        room: roomName
                    };

                    // Add to room history
                    room.messages.push(leaveMessage);

                    // Broadcast leave message
                    io.to(roomName).emit('message', leaveMessage);

                    // Send updated user list
                    const roomUsers = Array.from(room.users).map(socketId => users.get(socketId)?.username).filter(Boolean);
                    io.to(roomName).emit('roomUsers', { room: roomName, users: roomUsers });

                    // Clean up empty room
                    if (room.users.size === 0) {
                        rooms.delete(roomName);
                        console.log(`Room ${roomName} deleted (empty)`);
                    }
                }
            });

            users.delete(socket.id);
        }

        console.log("Client disconnected:", socket.id);
    });
});

const PORT = process.env.PORT || 5001;

// Start server
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});