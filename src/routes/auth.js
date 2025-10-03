const express = require("express");
const crypto = require("crypto");
const { body, validationResult } = require("express-validator");
const pool = require("../config/db");
const { hashPassword, comparePassword } = require("../utils/password");
const { sendPasswordResetEmail } = require("../utils/email");
const { ensureGuest } = require("../middleware/auth");

const router = express.Router();

router.get("/login", ensureGuest, (req, res) => {
  res.render("auth/login", { title: "Login" });
});

router.post(
  "/login",
  body("email").isEmail().normalizeEmail(),
  body("password").isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .render("auth/login", { title: "Login", errors: errors.array() });
    }
    const { email, password } = req.body;
    const [rows] = await pool.query(
      "SELECT id, name, email, password_hash, role FROM users WHERE email = ? LIMIT 1",
      [email],
    );
    if (rows.length === 0) {
      return res.status(400).render("auth/login", {
        title: "Login",
        errors: [{ msg: "Email atau password salah" }],
      });
    }
    const user = rows[0];
    const ok = await comparePassword(password, user.password_hash);
    if (!ok) {
      return res.status(400).render("auth/login", {
        title: "Login",
        errors: [{ msg: "Email atau password salah" }],
      });
    }
    await pool.query("UPDATE users SET last_login_at = NOW() WHERE id = ?", [
      user.id,
    ]);
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
    const redirectTo = req.session.returnTo || "/";
    delete req.session.returnTo;
    res.redirect(redirectTo);
  },
);

router.get("/register", ensureGuest, (req, res) => {
  res.render("auth/register", { title: "Register" });
});

router.post(
  "/register",
  body("name").trim().isLength({ min: 2, max: 100 }),
  body("email").isEmail().normalizeEmail(),
  body("password").isStrongPassword({
    minLength: 8,
    minNumbers: 1,
    minSymbols: 1,
  }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .render("auth/register", { title: "Register", errors: errors.array() });
    }
    const { name, email, password } = req.body;
    const [exist] = await pool.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email],
    );
    if (exist.length > 0) {
      return res.status(400).render("auth/register", {
        title: "Register",
        errors: [{ msg: "Email sudah terdaftar" }],
      });
    }
    const passwordHash = await hashPassword(password);
    await pool.query(
      "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
      [name, email, passwordHash],
    );
    res.redirect("/login");
  },
);

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie(process.env.SESSION_NAME || "sid");
    res.redirect("/");
  });
});

router.get("/forgot", ensureGuest, (req, res) => {
  res.render("auth/forgot", { title: "Lupa Password" });
});

router.post(
  "/forgot",
  body("email").isEmail().normalizeEmail(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render("auth/forgot", {
        title: "Lupa Password",
        errors: errors.array(),
      });
    }
    const { email } = req.body;
    const [rows] = await pool.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email],
    );
    if (rows.length === 0) {
      // Avoid leaking info
      return res.render("auth/forgot", {
        title: "Lupa Password",
        info: "Jika email terdaftar, tautan reset telah dikirim.",
      });
    }
    const userId = rows[0].id;
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await pool.query(
      "INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
      [userId, tokenHash, expiresAt],
    );
    const baseUrl =
      process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
    const resetUrl = `${baseUrl}/reset/${token}`;
    await sendPasswordResetEmail(email, resetUrl);
    return res.render("auth/forgot", {
      title: "Lupa Password",
      info: "Jika email terdaftar, tautan reset telah dikirim.",
    });
  },
);

router.get("/reset/:token", ensureGuest, async (req, res) => {
  const tokenHash = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");
  const [rows] = await pool.query(
    "SELECT id, user_id, expires_at, used FROM password_resets WHERE token_hash = ? LIMIT 1",
    [tokenHash],
  );
  if (
    rows.length === 0 ||
    rows[0].used ||
    new Date(rows[0].expires_at) < new Date()
  ) {
    return res.status(400).send("Token tidak valid atau kadaluarsa");
  }
  res.render("auth/reset", {
    title: "Reset Password",
    token: req.params.token,
  });
});

router.post(
  "/reset/:token",
  body("password").isStrongPassword({
    minLength: 8,
    minNumbers: 1,
    minSymbols: 1,
  }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render("auth/reset", {
        title: "Reset Password",
        token: req.params.token,
        errors: errors.array(),
      });
    }
    const token = req.params.token;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const [rows] = await pool.query(
      "SELECT id, user_id, expires_at, used FROM password_resets WHERE token_hash = ? LIMIT 1",
      [tokenHash],
    );
    if (
      rows.length === 0 ||
      rows[0].used ||
      new Date(rows[0].expires_at) < new Date()
    ) {
      return res.status(400).send("Token tidak valid atau kadaluarsa");
    }
    const userId = rows[0].user_id;
    const passwordHash = await hashPassword(req.body.password);
    await pool.query(
      "UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?",
      [passwordHash, userId],
    );
    await pool.query("UPDATE password_resets SET used = 1 WHERE id = ?", [
      rows[0].id,
    ]);
    res.redirect("/login");
  },
);

module.exports = router;
