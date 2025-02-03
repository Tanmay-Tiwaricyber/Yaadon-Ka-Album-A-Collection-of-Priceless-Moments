const express = require("express");
const session = require("express-session");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
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

// Temporary storage for posts
const posts = [];

// Ensure upload folders exist
const folders = ["A"];
folders.forEach((folder) => {
  fs.mkdirSync(path.join(__dirname, "public", "uploads", folder), { recursive: true });
});

// Multer setup for file uploads (images & videos)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = req.body.folder || "A";
    const uploadPath = path.join(__dirname, "public", "uploads", folder);
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "video/mp4", "video/webm"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only images and MP4/WEBM videos are allowed"));
    }
  },
});

// Routes
app.get("/", (req, res) => res.render("index")); // Home page (asks for name)

// Handle name submission and redirect to gallery
app.post("/get-name", (req, res) => {
  const { username } = req.body;
  if (!username) return res.redirect("/");
  req.session.user = username;
  res.redirect("/gallery");
});

// Show gallery with posts
app.get("/gallery", (req, res) => {
  if (!req.session.user) return res.redirect("/");
  res.render("gallery", { user: req.session.user, folders, posts });
});

// Upload image or video
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.session.user) return res.redirect("/");

  const { folder } = req.body;
  const filename = req.file.filename;
  const fileType = req.file.mimetype.startsWith("video/") ? "video" : "image";
  const username = req.session.user;

  // Save uploaded file details
  posts.push({ username, folder, filename, fileType });

  res.redirect(`/uploads/${folder}`);
});

// Show uploaded images & videos in folder
app.get("/uploads/:folder", (req, res) => {
  if (!req.session.user) return res.redirect("/");

  const folder = req.params.folder;
  const folderPath = path.join(__dirname, "public", "uploads", folder);

  fs.readdir(folderPath, (err, files) => {
    if (err) return res.status(404).send("Folder not found");
    const folderPosts = posts.filter((post) => post.folder === folder);
    res.render("folder", { folder, files, folderPosts });
  });
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

// Start server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
