const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads"))); // Serve uploads correctly
app.use(express.json()); // Enable JSON parsing
app.set("view engine", "ejs");

// Session setup for storing username
app.use(
  session({
    secret: "doodle_gallery_secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true },
  })
);

// Temporary storage
const users = []; // Store registered users
const posts = [];
const comments = {}; // Store comments per post
const likes = {}; // Store likes per post

// Ensure upload folders exist
const folders = ["A"];
folders.forEach((folder) => {
  fs.mkdirSync(path.join(__dirname, "public", "uploads", folder), { recursive: true });
});

// Load images and videos dynamically from uploads directory
const loadMediaFiles = () => {
  posts.length = 0; // Clear posts array
  folders.forEach((folder) => {
    const folderPath = path.join(__dirname, "public", "uploads", folder);
    const files = fs.readdirSync(folderPath);
    files.forEach((file, index) => {
      const fileType = file.split(".").pop().toLowerCase();
      posts.push({ id: (index + 1).toString(), username: "User", folder, filename: file, fileType: ["jpg", "jpeg", "png", "gif"].includes(fileType) ? "image" : "video" });
    });
  });
};
loadMediaFiles();

// Home page (asks for name)
app.get("/", (req, res) => res.render("index"));

// Handle name submission and redirect to gallery
app.post("/get-name", (req, res) => {
  const { username } = req.body;
  if (!username) return res.redirect("/");
  req.session.user = username;
  res.redirect("/gallery");
});

// Show gallery with dynamically loaded posts
app.get("/gallery", (req, res) => {
  if (!req.session.user) return res.redirect("/");
  loadMediaFiles(); // Refresh media files
  res.render("gallery", { user: req.session.user, folders, posts, likes, comments });
});

// Like a post (AJAX support)
app.post("/like", (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });

  const { postId } = req.body;
  if (!postId) return res.status(400).json({ error: "Invalid post ID" });

  if (!likes[postId]) {
      likes[postId] = [];
  }
  if (!likes[postId].includes(req.session.user)) {
      likes[postId].push(req.session.user);
  }

  res.json({ success: true, likes: likes[postId] });
});

// Comment on a post (AJAX support)
app.post("/comment", (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });

  const { postId, comment } = req.body;
  if (!postId || !comment) return res.status(400).json({ error: "Invalid request" });

  if (!comments[postId]) {
      comments[postId] = [];
  }
  comments[postId].push({ user: req.session.user, text: comment });

  res.json({ success: true, comments: comments[postId] });
});

// Delete comment (only for "deathnote")
app.post("/delete-comment", (req, res) => {
  if (!req.session.user || req.session.user !== "deathnote") return res.status(403).json({ error: "Permission denied" });

  const { postId, commentIndex } = req.body;
  if (!postId || commentIndex === undefined) return res.status(400).json({ error: "Invalid request" });

  if (comments[postId] && comments[postId][commentIndex]) {
    comments[postId].splice(commentIndex, 1);
    return res.json({ success: true, comments: comments[postId] });
  } else {
    return res.status(404).json({ error: "Comment not found" });
  }
});

// Serve file downloads
app.get("/download/:folder/:filename", (req, res) => {
  if (!req.session.user) return res.redirect("/");

  const { folder, filename } = req.params;
  const filePath = path.join(__dirname, "public", "uploads", folder, filename);

  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).send("File not found");
  }
});

// Show registered users
app.get("/users", (req, res) => {
  res.render("users", { users, loggedInUser: req.session.user });
});

// Start server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
