const express = require("express");
const session = require("express-session");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

// Session setup for authentication
app.use(
  session({
    secret: "doodle_gallery_secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true },
  })
);

// Temporary in-memory storage for users and posts
const users = []; // Stores registered users
const posts = []; // Stores uploaded images and videos with usernames

// Ensure default upload folders exist
const folders = ["A", "B", "C", "D", "E"];
folders.forEach((folder) => {
  fs.mkdirSync(path.join(__dirname, "public", "uploads", folder), { recursive: true });
});

// Multer setup for file uploads (images and videos)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = req.body.folder || "A"; // Default to folder A
    const uploadPath = path.join(__dirname, "public", "uploads", folder);
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Routes
app.get("/", (req, res) => res.render("index"));
app.get("/login", (req, res) => res.render("login"));
app.get("/register", (req, res) => res.render("register"));

// Show user list page (for admin)
app.get("/users", (req, res) => {
  if (!req.session.user || req.session.user !== "admin") return res.redirect("/login");

  res.render("users", { users, loggedInUser: req.session.user });
});

// Show gallery with posts (only if user is logged in)
app.get("/gallery", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  res.render("gallery", { user: req.session.user, folders, posts });
});

// Handle user registration
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  
  // Check if username is already taken
  if (users.find((u) => u.username === username)) {
    return res.send("Username already taken!");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  users.push({ username, password: hashedPassword });

  // Set the session user after registration
  req.session.user = username;

  // Redirect to the gallery after registration and login
  res.redirect("/gallery");
});

// Handle login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  // Check for admin login
  if (username === "admin" && password === "1234") {
    req.session.user = "admin"; // Grant access as admin
    return res.redirect("/users");
  }

  // Regular user login
  const user = users.find((u) => u.username === username);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.send("Invalid credentials");
  }

  req.session.user = username;
  res.redirect("/gallery");
});

// Upload image or video with user association
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const { folder } = req.body;
  const filename = req.file.filename;
  const username = req.session.user;

  // Save uploaded file details with username
  posts.push({ username, folder, filename, type: req.file.mimetype });

  res.redirect(`/uploads/${folder}`);
});

// Show images or videos inside a folder with uploader info
app.get("/uploads/:folder", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const folder = req.params.folder;
  const folderPath = path.join(__dirname, "public", "uploads", folder);

  fs.readdir(folderPath, (err, files) => {
    if (err) return res.status(404).send("Folder not found");

    // Filter posts for this folder
    const folderPosts = posts.filter((post) => post.folder === folder);

    res.render("folder", { folder, files, folderPosts });
  });
});

// Serve file downloads
app.get("/download/:folder/:filename", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const { folder, filename } = req.params;
  const filePath = path.join(__dirname, "public", "uploads", folder, filename);

  if (fs.existsSync(filePath)) {
    res.download(filePath); // Triggers file download
  } else {
    res.status(404).send("File not found");
  }
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

// Start server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
