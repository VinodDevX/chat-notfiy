const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");

const User = require("./models/User");
const Message = require("./models/Message");
const Group = require("./models/Group");

const app = express();
const server = http.createServer(app);

// ================= SOCKET SETUP =================

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(cors());
app.use(express.json());

// ================= MONGODB =================

mongoose
  .connect(
    "mongodb+srv://vinod_db_user:DqrWvMs0W30nnNHa@cluster0.ljppqwq.mongodb.net/chatapp?retryWrites=true&w=majority"
  )
  .then(() => console.log("MongoDB Connected ✅"))
  .catch((err) => console.log("Mongo Error ❌", err));

// ================= SOCKET =================

let onlineUsers = new Map(); // socketId => username

io.on("connection", (socket) => {

  console.log("User Connected:", socket.id);


  // ================= REGISTER =================
  socket.on("register", async (username) => {

    onlineUsers.set(socket.id, username);

    io.emit("onlineUsers", Array.from(onlineUsers.values()));
  });



  // ================= PRIVATE MESSAGE =================
  socket.on("sendMessage", async (data) => {

    const { sender, receiver, message } = data;

    const newMsg = await Message.create({
      sender,
      receiver,
      message,
      seen: false,
    });

    for (let [id, name] of onlineUsers) {

      if (name === receiver) {

        io.to(id).emit("receiveMessage", newMsg);

      }
    }
  });



  // ================= GROUP JOIN =================
  socket.on("joinGroup", (groupId) => {

    socket.join(groupId);

    console.log("Joined Group:", groupId);
  });



  // ================= GROUP MESSAGE =================
  socket.on("sendGroupMessage", async (data) => {

    const { sender, groupId, message } = data;

    const newMsg = await Message.create({
      sender,
      receiver: groupId,
      message,
    });

    io.to(groupId).emit("receiveGroupMessage", newMsg);
  });



  // ================= DISCONNECT =================
  socket.on("disconnect", () => {

    onlineUsers.delete(socket.id);

    io.emit("onlineUsers", Array.from(onlineUsers.values()));

    console.log("User Disconnected:", socket.id);
  });

});


// ================= API =================

// Get profile
app.get("/user/:name", async (req, res) => {
  const user = await User.findOne({
    username: req.params.name,
  });

  res.json(user);
});

// ================= GROUP =================

// Create group
app.post("/group", async (req, res) => {

  const { name, admin, members } = req.body;

  const group = await Group.create({
    name,
    admin,
    members: [admin, ...members], // auto add creator + users
  });

  res.json(group);
});


// Get my groups
app.get("/groups/:user", async (req, res) => {

  const groups = await Group.find({
    members: req.params.user,
  });

  res.json(groups);
});


// Group messages
app.get("/group-messages/:groupId", async (req, res) => {
  const msgs = await Message.find({
    receiver: req.params.groupId,
  }).sort({ createdAt: 1 });

  res.json(msgs);
});

// ================= CHAT =================

// Mark seen
app.put("/seen/:me/:other", async (req, res) => {
  const { me, other } = req.params;

  await Message.updateMany(
    {
      sender: other,
      receiver: me,
      seen: false,
    },
    {
      seen: true,
    }
  );

  res.json({ success: true });
});

// Unread count
app.get("/unread/:me", async (req, res) => {
  const me = req.params.me;

  const unread = await Message.aggregate([
    {
      $match: {
        receiver: me,
        seen: false,
      },
    },
    {
      $group: {
        _id: "$sender",
        count: { $sum: 1 },
      },
    },
  ]);

  res.json(unread);
});

// Private chat history
app.get("/messages/:user1/:user2", async (req, res) => {
  const { user1, user2 } = req.params;

  const messages = await Message.find({
    $or: [
      { sender: user1, receiver: user2 },
      { sender: user2, receiver: user1 },
    ],
  }).sort({ createdAt: 1 });

  res.json(messages);
});

// ================= START =================

server.listen(5000, () => {
  console.log("Server Running on 5000 🚀");
});
