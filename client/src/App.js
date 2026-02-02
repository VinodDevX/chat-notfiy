import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function App() {

  console.log("Rendering App component");

const showSystemNotification = async (title, body) => {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;

  registration.showNotification(title, {
    body,
    icon: "https://cdn-icons-png.flaticon.com/512/733/733585.png",
    badge: "https://cdn-icons-png.flaticon.com/512/733/733585.png",
    vibrate: [200, 100, 200],
  });
};


  useEffect(() => {

  if ("Notification" in window) {

    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }

  }

}, []);
useEffect(() => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js", {
      type: "classic" // ← IMPORTANT
    });
  }
}, []);




  // ================= UTILS =================
  const formatTime = (date) => {
    const d = new Date(date);
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ================= STATES =================
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  const [username, setUsername] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groups, setGroups] = useState([]);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [unread, setUnread] = useState([]);
  // removed unused isTyping state
  const [searchQuery, setSearchQuery] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef(null);

 


  // Auto scroll to bottom
  useEffect(() => {
    if ("Notification" in window) {

    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }

  }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ================= LOAD UNREAD =================
  const loadUnread = useCallback(async () => {
    const res = await fetch(`http://localhost:5000/unread/${username}`);
    const data = await res.json();
    setUnread(data);
  }, [username]);

  // ================= SOCKET =================
  useEffect(() => {
    if (!loggedIn) return;
    if (socketRef.current) return;

    const socket = io("http://localhost:5000", {
      transports: ["websocket"],
    });

    socketRef.current = socket;
    socket.emit("register", username);

    // socket.on("receiveMessage", (data) => {
    //   setMessages((prev) => [...prev, data]);
    //   toast.success(`💬 ${data.sender}: ${data.message}`, {
    //     position: "top-right",
    //     autoClose: 3000,
    //     hideProgressBar: false,
    //     closeOnClick: true,
    //     pauseOnHover: true,
    //     draggable: true,
    //     style: {
    //       background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    //       color: 'white',
    //       borderRadius: '12px',
    //       fontWeight: '500'
    //     }
    //   });
    //   loadUnread();
    // });

    socket.on("receiveMessage", (data) => {

  setMessages((prev) => [...prev, data]);

  toast.info(`${data.sender}: ${data.message}`);

  // 🔔 SYSTEM NOTIFICATION
 

    showSystemNotification(
    `Message from ${data.sender}`,
  data.message
    );

  

  loadUnread();
});

    
    // socket.on("receiveGroupMessage", (data) => {
    //   setMessages((prev) => [...prev, data]);
    // });

    socket.on("receiveGroupMessage", (data) => {

  setMessages((prev) => [...prev, data]);

  if (document.hidden) {

    showSystemNotification(
      "Group Message",
      `${data.sender}: ${data.message}`
    );

  }

});


    socket.on("onlineUsers", (users) => {
      setOnlineUsers(users.filter((u) => u !== username));
    });

    loadUnread();
    fetch(`http://localhost:5000/groups/${username}`)
      .then((res) => res.json())
      .then(setGroups);

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [loggedIn, username, loadUnread]);

  // ================= SELECT USER =================
  const selectUser = async (user) => {
    setSelectedUser(user);
    setSelectedGroup(null);

    const res = await fetch(`http://localhost:5000/messages/${username}/${user}`);
    const data = await res.json();
    setMessages(data);

    await fetch(`http://localhost:5000/seen/${username}/${user}`, { method: "PUT" });
    loadUnread();
  };

  // ================= SELECT GROUP =================
  const selectGroup = async (group) => {
    setSelectedGroup(group);
    setSelectedUser(null);
    socketRef.current.emit("joinGroup", group._id);

    const res = await fetch(`http://localhost:5000/group-messages/${group._id}`);
    const data = await res.json();
    setMessages(data);
  };

  // ================= CREATE GROUP =================
  const createGroup = async () => {
    const name = prompt("Enter Group Name:");
    if (!name) return;

    const res = await fetch("http://localhost:5000/group", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        admin: username,
        members: onlineUsers,
      }),
    });

    const data = await res.json();
    setGroups((prev) => [...prev, data]);
  };

  // ================= LOGIN =================
  const handleLogin = () => {
    if (!username.trim()) {
      toast.error("Please enter your name");
      return;
    }
    setLoggedIn(true);
  };

  // ================= SEND =================
  const sendMessage = () => {
    if (!message.trim()) return;

    if (selectedGroup) {
      socketRef.current.emit("sendGroupMessage", {
        sender: username,
        groupId: selectedGroup._id,
        message,
      });
    } else if (selectedUser) {
      socketRef.current.emit("sendMessage", {
        sender: username,
        receiver: selectedUser,
        message,
      });
    }

    setMessages((prev) => [
      ...prev,
      {
        sender: username,
        receiver: selectedUser || selectedGroup?._id,
        message,
        createdAt: new Date(),
      },
    ]);

    setMessage("");
  };

  const emojis = ['😀','😄','😍','😂','👍','🎉','❤️','🔥','😢','🙏','👀','👥'];

  const addEmoji = (e) => {
    setMessage((prev) => prev + e);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  // ================= UNREAD =================
  const getUnread = (user) => {
    const found = unread.find((u) => u._id === user);
    return found ? found.count : 0;
  };

  // ================= FILTER USERS =================
  const filteredUsers = onlineUsers.filter(user => 
    user.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGroups = groups.filter(group => 
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ================= LOGIN UI =================
  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4 relative overflow-hidden">
        
        {/* Animated Background Shapes */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-40 left-20 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative z-10 border border-gray-100">
          
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-3xl flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform duration-300">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 border-4 border-white rounded-full"></div>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">
            Welcome to ChatApp
          </h1>
          <p className="text-center text-gray-500 mb-8">
            Connect with your friends instantly
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Your Name
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="Enter your name"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition-all text-gray-800 placeholder-gray-400"
              />
            </div>

            <button
              onClick={handleLogin}
              className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <span>Get Started</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            By continuing, you agree to our Terms of Service
          </p>

        </div>
      </div>
    );
  }

  // ================= CHAT UI =================
  return (
    <div className="h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">

      <ToastContainer />

      <div className="w-full max-w-7xl h-full max-h-[900px] bg-white rounded-2xl shadow-2xl flex overflow-hidden">

        {/* ========== SIDEBAR ========== */}
        <div className="w-96 bg-white border-r border-gray-200 flex flex-col">

          {/* Profile Header */}
          <div className="p-4 bg-gradient-to-r from-emerald-500 to-cyan-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-emerald-600 font-bold text-lg shadow-md">
                    {username[0]?.toUpperCase()}
                  </div>
                  <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-400 border-2 border-white rounded-full"></div>
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg">{username}</h3>
                  <p className="text-emerald-100 text-xs">Active now</p>
                </div>
              </div>
              
              <button className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            </div>

            {/* Search Bar */}
            <div className="mt-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/90 backdrop-blur-sm text-gray-800 placeholder-gray-500 pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 bg-gray-50">
            <button className="flex-1 py-3 text-sm font-semibold text-emerald-600 border-b-2 border-emerald-600 bg-white">
              Chats
            </button>
            <button className="flex-1 py-3 text-sm font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              Groups
            </button>
          </div>

          {/* Users List */}
          <div className="flex-1 overflow-y-auto">
            
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Online • {filteredUsers.length}
                </h4>
              </div>

              {filteredUsers.map((user) => (
                <div
                  key={user}
                  onClick={() => selectUser(user)}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all mb-1 ${
                    selectedUser === user
                      ? "bg-gradient-to-r from-emerald-50 to-cyan-50 border-l-4 border-emerald-500"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="relative">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold shadow-md">
                      {user[0]?.toUpperCase()}
                    </div>
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-400 border-2 border-white rounded-full"></div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h4 className="font-semibold text-gray-800 truncate">{user}</h4>
                      {getUnread(user) > 0 && (
                        <span className="ml-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md">
                          {getUnread(user)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">Click to start chatting</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Groups Section */}
            <div className="border-t border-gray-200 p-3">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Groups • {filteredGroups.length}
                </h4>
                <button
                  onClick={createGroup}
                  className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:shadow-md transition-all flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New
                </button>
              </div>

              {filteredGroups.map((g) => (
                <div
                  key={g._id}
                  onClick={() => selectGroup(g)}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all mb-1 ${
                    selectedGroup?._id === g._id
                      ? "bg-gradient-to-r from-emerald-50 to-cyan-50 border-l-4 border-emerald-500"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-pink-500 rounded-full flex items-center justify-center text-2xl shadow-md">
                    👥
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-800 truncate">{g.name}</h4>
                    <p className="text-xs text-gray-500">Group chat</p>
                  </div>
                </div>
              ))}
            </div>

          </div>

        </div>

        {/* ========== CHAT AREA ========== */}
        <div className="flex-1 flex flex-col bg-gradient-to-b from-gray-50 to-white">

          {/* Chat Header */}
          <div className="h-16 px-6 flex items-center justify-between border-b border-gray-200 bg-white shadow-sm">
            
            {selectedGroup ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-pink-500 rounded-full flex items-center justify-center shadow-md">
                  👥
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">{selectedGroup.name}</h3>
                  <p className="text-xs text-gray-500">Group • {onlineUsers.length} members</p>
                </div>
              </div>
            ) : selectedUser ? (
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold shadow-md">
                    {selectedUser[0]?.toUpperCase()}
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-white rounded-full"></div>
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">{selectedUser}</h3>
                  <p className="text-xs text-green-500 font-medium">Active now</p>
                </div>
              </div>
            ) : (
              <div className="text-gray-400">Select a conversation</div>
            )}

            <div className="flex items-center gap-2">
              <button className="w-9 h-9 hover:bg-gray-100 rounded-full flex items-center justify-center transition-colors">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              <button className="w-9 h-9 hover:bg-gray-100 rounded-full flex items-center justify-center transition-colors">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            </div>

          </div>

          {/* Messages Area */}
          <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZjNmNGY2IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] bg-repeat">

            {(selectedUser || selectedGroup) ? (
              <>
                {messages
                  .filter((m) => {
                    if (selectedGroup) {
                      return m.receiver === selectedGroup._id;
                    }
                    return (
                      (m.sender === username && m.receiver === selectedUser) ||
                      (m.sender === selectedUser && m.receiver === username)
                    );
                  })
                  .map((msg, i) => {
                    const isOwn = msg.sender === username;
                    return (
                      <div key={i} className={`flex ${isOwn ? "justify-end" : "justify-start"} items-end gap-2`}>
                        
                        {!isOwn && (
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md flex-shrink-0">
                            {msg.sender[0]?.toUpperCase()}
                          </div>
                        )}

                        <div className={`max-w-md ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
                          
                          {selectedGroup && !isOwn && (
                            <span className="text-xs font-semibold text-gray-600 mb-1 px-2">
                              {msg.sender}
                            </span>
                          )}

                          <div className={`px-4 py-2.5 rounded-2xl shadow-md ${
                            isOwn
                              ? "bg-gradient-to-br from-emerald-500 to-cyan-500 text-white rounded-br-md"
                              : "bg-white text-gray-800 rounded-bl-md border border-gray-100"
                          }`}>
                            <p className="text-sm leading-relaxed break-words">{msg.message}</p>
                          </div>

                          <div className="flex items-center gap-1 mt-1 px-2">
                            <span className={`text-[10px] ${isOwn ? "text-gray-500" : "text-gray-400"}`}>
                              {formatTime(msg.createdAt)}
                            </span>
                            {isOwn && (
                              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>

                        </div>

                        {isOwn && (
                          <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md flex-shrink-0">
                            {username[0]?.toUpperCase()}
                          </div>
                        )}

                      </div>
                    );
                  })}
                <div ref={messagesEndRef} />
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl">
                    <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-700 mb-2">Start a Conversation</h3>
                  <p className="text-gray-500">Select a chat from the sidebar to begin messaging</p>
                </div>
              </div>
            )}

          </div>

          {/* Message Input */}
          {(selectedUser || selectedGroup) && (
            <div className="p-4 bg-white border-t border-gray-200">
              <div className="flex items-end gap-3">
                
                <button
                  onClick={() => setShowEmojiPicker((s) => !s)}
                  className="w-10 h-10 hover:bg-gray-100 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
                  aria-label="Emoji picker"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>

                <button className="w-10 h-10 hover:bg-gray-100 rounded-full flex items-center justify-center transition-colors flex-shrink-0">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>

                <div className="flex-1 relative">
                  <div className="bg-gray-100 rounded-2xl px-4 py-2 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500 transition-all">
                    <input
                      ref={inputRef}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                      placeholder="Type a message..."
                      className="w-full bg-transparent outline-none text-gray-800 placeholder-gray-500"
                    />
                  </div>

                  {showEmojiPicker && (
                    <div className="absolute bottom-14 left-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 flex gap-2 flex-wrap w-56">
                      {emojis.map((em) => (
                        <button
                          key={em}
                          onClick={() => addEmoji(em)}
                          className="p-1 text-lg hover:bg-gray-100 rounded-md"
                          aria-label={`Add ${em}`}
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={sendMessage}
                  className="w-11 h-11 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all flex items-center justify-center flex-shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>

              </div>
            </div>
          )}

        </div>

      </div>

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -50px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(50px, 50px) scale(1.05); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>

    </div>
  );
}