const express = require("express");
const pool = require("../config/db");
const { ensureAuthenticated, ensureAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/admin", ensureAuthenticated, ensureAdmin, async (req, res) => {
  const [[usersCount]] = await pool.query("SELECT COUNT(*) AS c FROM users");
  const [[productsCount]] = await pool.query(
    "SELECT COUNT(*) AS c FROM products",
  );
  const [[ordersCount]] = await pool.query("SELECT COUNT(*) AS c FROM orders");
  const [[revenueSum]] = await pool.query(
    "SELECT IFNULL(SUM(total_amount),0) AS s FROM orders WHERE payment_status IN ('paid','pending')",
  );
  const [revenueDaily] = await pool.query(
    `SELECT DATE(created_at) AS d, SUM(total_amount) AS s
     FROM orders WHERE payment_status IN ('paid','pending')
     GROUP BY DATE(created_at)
     ORDER BY d DESC LIMIT 7`,
  );
  res.render("admin/dashboard", {
    title: "Admin - Dashboard",
    stats: {
      users: usersCount.c,
      products: productsCount.c,
      orders: ordersCount.c,
      revenue: revenueSum.s,
      revenueDaily,
    },
  });
});

module.exports = router;
