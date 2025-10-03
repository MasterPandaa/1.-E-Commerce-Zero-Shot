/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config();
const bcrypt = require("bcryptjs");

(async () => {
  const {
    DB_HOST = "127.0.0.1",
    DB_PORT = "3306",
    DB_USER = "root",
    DB_PASSWORD = "",
    DB_NAME = "ecommerce",
    ADMIN_EMAIL = "admin@example.com",
    ADMIN_PASSWORD = "Admin123!",
  } = process.env;

  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: true,
  });

  try {
    const schemaPath = path.join(__dirname, "..", "db", "schema.sql");
    const sql = fs.readFileSync(schemaPath, "utf8");
    console.log("Running schema migration...");
    await connection.query(sql);

    // Seed admin user if not exists
    console.log("Seeding admin user if not exists...");
    await connection.query("USE ??", [DB_NAME]);
    const [rows] = await connection.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [ADMIN_EMAIL],
    );
    if (rows.length === 0) {
      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
      await connection.query(
        "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
        ["Administrator", ADMIN_EMAIL, passwordHash, "admin"],
      );
      console.log(`Admin user created: ${ADMIN_EMAIL}`);
    } else {
      console.log("Admin user already exists.");
    }

    console.log("Migration completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
})();
