import React, { useState, useEffect } from 'react'
import { io } from 'socket.io-client'

const socket = io("http://localhost:5001");

const App = () => {
  // Declare useStates
  const [username, setUsername] = useState("");
  const [room, setRoom] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    socket.on('message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    })

    return () => {
      socket.off('message')
    }
  }, [])

  const joinRoom = () => {
    if (username && room) {
      socket.emit('join', { username, room})
    }
  }

  const sendMessage = () => {
    if (message) {
      socket.emit('sendMessage', message); 
      setMessage("");
    }
  }

  return (
    <div>
      <h1>Chat App</h1>
      <input
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        placeholder="Room"
        value={room}
        onChange={(e) => setRoom(e.target.value)}
      />
      <button onClick={joinRoom}>Join Room</button>

      <div>
        <input
          placeholder="Message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button onClick={sendMessage}>Send</button>
      </div>

      <div>
        <h2>Messages:</h2>
        {messages.map((msg, i) => (
          <div key={i}>
            <strong>{msg.user}:</strong> {msg.text}
          </div>
        ))}
      </div>
    </div>
  )
}

export default App

