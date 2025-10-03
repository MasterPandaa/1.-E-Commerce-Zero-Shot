const path = require("path");
const express = require("express");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const morgan = require("morgan");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const csrf = require("csurf");
const cors = require("cors");
require("dotenv").config();

const routes = require("./routes");

const app = express();

// Trust proxy if behind reverse proxy
app.set("trust proxy", 1);

// View engine
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Static
app.use("/public", express.static(path.join(process.cwd(), "public")));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Log & security
app.use(morgan("dev"));
app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);
app.use(compression());

// CORS (adjust origin for production)
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Sessions
const {
  DB_HOST = "127.0.0.1",
  DB_PORT = "3306",
  DB_USER = "root",
  DB_PASSWORD = "",
  DB_NAME = "ecommerce",
  SESSION_SECRET = "change_this_secret",
  SESSION_NAME = "sid",
} = process.env;

const sessionStore = new MySQLStore({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  createDatabaseTable: true,
  clearExpired: true,
  checkExpirationInterval: 15 * 60 * 1000,
  expiration: 24 * 60 * 60 * 1000,
});

app.use(
  session({
    name: SESSION_NAME,
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

// Rate limiter
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use(apiLimiter);

// CSRF (skip on file upload endpoints to allow multer to parse first)
const csrfProtection = csrf();
app.use((req, res, next) => {
  const isAdminProductUpload =
    req.method === "POST" &&
    (/^\/admin\/products\/new$/.test(req.path) ||
      /^\/admin\/products\/[0-9]+\/edit$/.test(req.path));
  if (isAdminProductUpload) return next();
  return csrfProtection(req, res, next);
});
app.use((req, res, next) => {
  res.locals.csrfToken =
    typeof req.csrfToken === "function" ? req.csrfToken() : "";
  res.locals.user = req.session.user || null;
  next();
});

// Locals for UI
app.use((req, res, next) => {
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

// Routes
app.use(routes);

// 404
app.use((req, res) => {
  res.status(404).render("404", { title: "Not Found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === "EBADCSRFTOKEN") {
    return res.status(403).send("Invalid CSRF token");
  }
  res.status(500).send("Internal Server Error");
});

module.exports = app;
