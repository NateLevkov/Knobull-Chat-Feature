import express from 'express';
import http from 'http';
import { Server as socketio } from "socket.io";

const users = new Map();

const app = express();
const server = http.createServer(app);

// Create socket.io server
const io = new socketio(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log("User has connected:", socket.id);

    // Join event
    socket.on('join', ({ username, room }) => {
        users.set(socket.id, { username, room });
        socket.join(room);
        console.log(`${username} joined room ${room}`);

        
        io.to(room).emit('message', {
            user: 'admin',
            text: `${username} has joined the room!`
        });
    });

    // Send message event
    socket.on('sendMessage', (message) => {
        const user = users.get(socket.id); // get user by socket.id

        if (user) {
            io.to(user.room).emit('message', {
                user: user.username,
                text: message
            });
        }
    });

    // Disconnect event
    socket.on('disconnect', () => {
        const user = users.get(socket.id);

        if (user) {
            io.to(user.room).emit('message', {
                user: 'admin',
                text: `${user.username} has left the room.`
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
