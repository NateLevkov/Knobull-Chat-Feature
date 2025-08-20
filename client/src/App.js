import React, { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import './App.css'

const socket = io("http://localhost:5001");

const App = () => {
  // User state
  const [username, setUsername] = useState("");
  const [isUsernameSet, setIsUsernameSet] = useState(false);
  
  // Room state
  const [roomList, setRoomList] = useState([]);
  const [currentRoom, setCurrentRoom] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [roomUsers, setRoomUsers] = useState({});
  
  // Message state
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});
  
  // Refs
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Listen for messages
    socket.on('message', (msg) => {
      setMessages((prev) => ({
        ...prev,
        [msg.room]: [...(prev[msg.room] || []), msg]
      }));

      // Update unread count if not in current room
      if (msg.room !== currentRoom && msg.user !== 'admin') {
        setUnreadCounts(prev => ({
          ...prev,
          [msg.room]: (prev[msg.room] || 0) + 1
        }));
      }
    });

    // Listen for room history
    socket.on('roomHistory', ({ room, messages: roomMessages }) => {
      setMessages((prev) => ({
        ...prev,
        [room]: roomMessages
      }));
    });

    // Listen for room list updates
    socket.on('roomList', (rooms) => {
      setRoomList(rooms);
    });

    // Listen for room users updates
    socket.on('roomUsers', ({ room, users }) => {
      setRoomUsers(prev => ({
        ...prev,
        [room]: users
      }));
    });

    return () => {
      socket.off('message');
      socket.off('roomHistory');
      socket.off('roomList');
      socket.off('roomUsers');
    };
  }, [currentRoom]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages[currentRoom]]);

  // Clear unread count when switching rooms
  useEffect(() => {
    if (currentRoom) {
      setUnreadCounts(prev => ({
        ...prev,
        [currentRoom]: 0
      }));
    }
  }, [currentRoom]);

  const setUsernameHandler = () => {
    if (username.trim()) {
      socket.emit('setUsername', username.trim());
      setIsUsernameSet(true);
    }
  };

  const joinRoom = () => {
    if (newRoomName.trim()) {
      socket.emit('joinRoom', newRoomName.trim());
      setCurrentRoom(newRoomName.trim());
      setNewRoomName("");
    }
  };

  const switchRoom = (roomName) => {
    setCurrentRoom(roomName);
  };

  const leaveRoom = (roomName, e) => {
    e.stopPropagation();
    socket.emit('leaveRoom', roomName);
    if (currentRoom === roomName) {
      setCurrentRoom(roomList.length > 1 ? roomList.find(r => r.name !== roomName)?.name || "" : "");
    }
  };

  const sendMessage = () => {
    if (message.trim() && currentRoom) {
      socket.emit('sendMessage', { room: currentRoom, message: message.trim() });
      setMessage("");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      if (!isUsernameSet) {
        setUsernameHandler();
      } else if (newRoomName) {
        joinRoom();
      } else {
        sendMessage();
      }
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  if (!isUsernameSet) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h1>Welcome to Chat App</h1>
          <input
            className="username-input"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyPress={handleKeyPress}
            autoFocus
          />
          <button className="join-btn" onClick={setUsernameHandler}>
            Join Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>Chat Rooms</h2>
          <div className="user-info">👤 {username}</div>
        </div>
        
        {/* Join new room */}
        <div className="join-room-section">
          <input
            className="room-input"
            placeholder="Room name"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button className="join-room-btn" onClick={joinRoom}>
            Join
          </button>
        </div>

        {/* Room list */}
        <div className="room-list">
          {roomList.map((room) => (
            <div
              key={room.name}
              className={`room-item ${currentRoom === room.name ? 'active' : ''}`}
              onClick={() => switchRoom(room.name)}
            >
              <div className="room-info">
                <div className="room-name">
                  #{room.name}
                  {unreadCounts[room.name] > 0 && (
                    <span className="unread-badge">{unreadCounts[room.name]}</span>
                  )}
                </div>
                <div className="room-meta">
                  {room.userCount} user{room.userCount !== 1 ? 's' : ''}
                  {room.lastMessage && (
                    <div className="last-message">
                      {room.lastMessage.user}: {room.lastMessage.text.substring(0, 30)}...
                    </div>
                  )}
                </div>
              </div>
              <button
                className="leave-btn"
                onClick={(e) => leaveRoom(room.name, e)}
                title="Leave room"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="main-chat">
        {currentRoom ? (
          <>
            {/* Chat header */}
            <div className="chat-header">
              <h2>#{currentRoom}</h2>
              <div className="online-users">
                {roomUsers[currentRoom]?.map((user, i) => (
                  <span key={i} className="user-badge">
                    {user}
                  </span>
                ))}
              </div>
            </div>

            {/* Messages */}
            <div className="messages-container">
              {(messages[currentRoom] || []).map((msg, i) => (
                <div
                  key={i}
                  className={`message ${msg.user === 'admin' ? 'system-message' : ''} ${
                    msg.user === username ? 'own-message' : ''
                  }`}
                >
                  <div className="message-header">
                    <strong className="message-user">{msg.user}</strong>
                    {msg.timestamp && (
                      <span className="message-time">{formatTime(msg.timestamp)}</span>
                    )}
                  </div>
                  <div className="message-text">{msg.text}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <div className="message-input-container">
              <input
                className="message-input"
                placeholder={`Message #${currentRoom}`}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <button className="send-btn" onClick={sendMessage}>
                Send
              </button>
            </div>
          </>
        ) : (
          <div className="no-room-selected">
            <h2>Welcome to Chat App!</h2>
            <p>Select a room from the sidebar or create a new one to start chatting.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;