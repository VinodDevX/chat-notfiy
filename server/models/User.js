const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({

  username: {
    type: String,
    unique: true,
    required: true,
  },

  photo: {
    type: String,
    default:
      "https://i.pravatar.cc/150"
  },

  status: {
    type: String,
    default: "Hey there! I am using ChatApp"
  },

  lastSeen: {
    type: Date,
    default: Date.now,
  }

});

module.exports = mongoose.model("User", userSchema);

