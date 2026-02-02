const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema({

  name: String,

  admin: String,

  members: [String],

}, { timestamps: true });

module.exports = mongoose.model("Group", groupSchema);
