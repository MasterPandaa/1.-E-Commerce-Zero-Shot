const express = require("express");
const { body, validationResult } = require("express-validator");
const pool = require("../config/db");
const { ensureAuthenticated } = require("../middleware/auth");

const router = express.Router();

async function getCartItems(conn, userId) {
  const [rows] = await conn.query(
    `SELECT ci.product_id, ci.quantity, ci.unit_price, (ci.quantity * ci.unit_price) AS subtotal,
            p.name, p.image_url, p.stock
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     WHERE ci.user_id = ? FOR UPDATE`,
    [userId],
  );
  return rows;
}

function computeTotals(items) {
  const subtotal = items.reduce((sum, it) => sum + Number(it.subtotal), 0);
  const shipping = 0;
  const total = subtotal + shipping;
  return { subtotal, shipping, total };
}

router.get("/checkout", ensureAuthenticated, async (req, res) => {
  const userId = req.session.user.id;
  const [rows] = await pool.query(
    `SELECT ci.product_id, ci.quantity, ci.unit_price, (ci.quantity * ci.unit_price) AS subtotal,
            p.name, p.image_url, p.stock
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     WHERE ci.user_id = ?`,
    [userId],
  );
  const totals = computeTotals(rows);
  if (totals.total <= 0) {
    req.session.flash = { type: "error", message: "Keranjang kosong" };
    return res.redirect("/cart");
  }
  res.render("checkout/index", { title: "Checkout", items: rows, totals });
});

router.post(
  "/checkout",
  ensureAuthenticated,
  body("address").trim().isLength({ min: 5 }),
  body("city").trim().isLength({ min: 2 }),
  body("postal_code").trim().isLength({ min: 3 }),
  body("country").trim().isLength({ min: 2 }),
  body("phone").trim().isLength({ min: 6 }),
  body("payment_method").isIn(["cod"]),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.session.flash = {
        type: "error",
        message: "Data checkout tidak valid",
      };
      return res.redirect("/checkout");
    }
    const userId = req.session.user.id;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const items = await getCartItems(conn, userId);
      if (items.length === 0) {
        await conn.rollback();
        req.session.flash = { type: "error", message: "Keranjang kosong" };
        return res.redirect("/cart");
      }
      const totals = computeTotals(items);

      // Check stock
      for (const it of items) {
        if (it.quantity > it.stock) {
          await conn.rollback();
          req.session.flash = {
            type: "error",
            message: `Stok tidak cukup untuk ${it.name}`,
          };
          return res.redirect("/cart");
        }
      }

      // Create order
      const { address, city, postal_code, country, phone, payment_method } =
        req.body;
      const [orderRes] = await conn.query(
        `INSERT INTO orders (user_id, total_amount, payment_status, fulfillment_status, payment_method, address, city, postal_code, country, phone)
         VALUES (?, ?, 'pending', 'pending', ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          totals.total,
          payment_method,
          address,
          city,
          postal_code,
          country,
          phone,
        ],
      );
      const orderId = orderRes.insertId;

      // Insert order items and decrement stock
      for (const it of items) {
        const subtotal = Number(it.quantity) * Number(it.unit_price);
        await conn.query(
          "INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)",
          [orderId, it.product_id, it.quantity, it.unit_price, subtotal],
        );
        const [upd] = await conn.query(
          "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?",
          [it.quantity, it.product_id, it.quantity],
        );
        if (upd.affectedRows === 0) {
          await conn.rollback();
          req.session.flash = {
            type: "error",
            message: `Stok berubah untuk ${it.name}, silakan coba lagi`,
          };
          return res.redirect("/cart");
        }
      }

      // Clear cart
      await conn.query("DELETE FROM cart_items WHERE user_id = ?", [userId]);

      await conn.commit();
      req.session.flash = {
        type: "success",
        message: `Pesanan berhasil dibuat (#${orderId}). Pembayaran: COD`,
      };
      res.redirect("/");
    } catch (e) {
      console.error(e);
      await conn.rollback();
      req.session.flash = {
        type: "error",
        message: "Terjadi kesalahan saat checkout",
      };
      res.redirect("/checkout");
    } finally {
      conn.release();
    }
  },
);

module.exports = router;
