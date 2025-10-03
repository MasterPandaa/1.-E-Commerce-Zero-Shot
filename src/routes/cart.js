const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/db');
const { ensureAuthenticated } = require('../middleware/auth');

const router = express.Router();

function computeTotals(items) {
  const subtotal = items.reduce((sum, it) => sum + Number(it.subtotal), 0);
  const shipping = subtotal > 0 ? 0 : 0; // free shipping default
  const total = subtotal + shipping;
  return { subtotal, shipping, total };
}

router.get('/cart', ensureAuthenticated, async (req, res) => {
  const userId = req.session.user.id;
  const [rows] = await pool.query(
    `SELECT ci.product_id, ci.quantity, ci.unit_price, (ci.quantity * ci.unit_price) AS subtotal,
            p.name, p.image_url, p.stock
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     WHERE ci.user_id = ?`, [userId]
  );
  const totals = computeTotals(rows);
  res.render('cart/index', { title: 'Keranjang', items: rows, totals });
});

router.post('/cart/add', ensureAuthenticated,
  body('product_id').isInt({ min: 1 }),
  body('quantity').isInt({ min: 1 }).toInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.session.flash = { type: 'error', message: 'Input tidak valid' };
      return res.redirect('back');
    }
    const userId = req.session.user.id;
    const { product_id, quantity } = req.body;
    const [prodRows] = await pool.query('SELECT id, price, stock, is_active FROM products WHERE id = ? LIMIT 1', [product_id]);
    if (prodRows.length === 0 || !prodRows[0].is_active) {
      req.session.flash = { type: 'error', message: 'Produk tidak tersedia' };
      return res.redirect('back');
    }
    const product = prodRows[0];
    const [existRows] = await pool.query('SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ? LIMIT 1', [userId, product.id]);
    const currentQty = existRows.length ? Number(existRows[0].quantity) : 0;
    const newQty = Math.max(1, Math.min(product.stock, currentQty + Number(quantity)));
    if (existRows.length) {
      await pool.query('UPDATE cart_items SET quantity = ?, unit_price = ? WHERE user_id = ? AND product_id = ? LIMIT 1', [newQty, product.price, userId, product.id]);
    } else {
      await pool.query('INSERT INTO cart_items (user_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)', [userId, product.id, newQty, product.price]);
    }
    req.session.flash = { type: 'success', message: 'Produk ditambahkan ke keranjang' };
    res.redirect('/cart');
  }
);

router.post('/cart/update', ensureAuthenticated,
  body('product_id').isInt({ min: 1 }),
  body('quantity').isInt({ min: 0 }).toInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.session.flash = { type: 'error', message: 'Input tidak valid' };
      return res.redirect('/cart');
    }
    const userId = req.session.user.id;
    const { product_id, quantity } = req.body;
    if (Number(quantity) === 0) {
      await pool.query('DELETE FROM cart_items WHERE user_id = ? AND product_id = ? LIMIT 1', [userId, product_id]);
      return res.redirect('/cart');
    }
    const [prodRows] = await pool.query('SELECT stock, price FROM products WHERE id = ? LIMIT 1', [product_id]);
    if (prodRows.length === 0) return res.redirect('/cart');
    const qty = Math.min(Number(quantity), Number(prodRows[0].stock));
    await pool.query('UPDATE cart_items SET quantity = ?, unit_price = ? WHERE user_id = ? AND product_id = ? LIMIT 1', [qty, prodRows[0].price, userId, product_id]);
    res.redirect('/cart');
  }
);

router.post('/cart/remove', ensureAuthenticated, body('product_id').isInt({ min: 1 }), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.redirect('/cart');
  }
  await pool.query('DELETE FROM cart_items WHERE user_id = ? AND product_id = ? LIMIT 1', [req.session.user.id, req.body.product_id]);
  res.redirect('/cart');
});

module.exports = router;
