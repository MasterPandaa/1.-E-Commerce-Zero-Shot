const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/db');
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');
const { upload, processImage } = require('../utils/file');
const csrf = require('csurf');
const csrfProtection = csrf();

const router = express.Router();

router.get('/', async (req, res) => {
  const [products] = await pool.query('SELECT id, name, price, image_url FROM products WHERE is_active = 1 ORDER BY created_at DESC LIMIT 12');
  res.render('home', { title: 'Home', products });
});

router.get('/products', async (req, res) => {
  const { q = '', category = '', minPrice = '', maxPrice = '', page = '1', pageSize = '12' } = req.query;
  const offset = (Number(page) - 1) * Number(pageSize);
  const params = [];
  let where = 'WHERE is_active = 1';
  if (q) { where += ' AND name LIKE ?'; params.push(`%${q}%`); }
  if (category) { where += ' AND category = ?'; params.push(category); }
  if (minPrice) { where += ' AND price >= ?'; params.push(Number(minPrice)); }
  if (maxPrice) { where += ' AND price <= ?'; params.push(Number(maxPrice)); }
  const [rows] = await pool.query(`SELECT SQL_CALC_FOUND_ROWS id, name, price, image_url FROM products ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, Number(pageSize), offset]);
  const [countRows] = await pool.query('SELECT FOUND_ROWS() as total');
  res.render('products/list', { title: 'Produk', products: rows, total: countRows[0].total, query: req.query });
});

router.get('/products/:id', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM products WHERE id = ? AND is_active = 1 LIMIT 1', [req.params.id]);
  if (rows.length === 0) return res.status(404).send('Produk tidak ditemukan');
  res.render('products/detail', { title: rows[0].name, product: rows[0] });
});

// Admin pages
router.get('/admin/products', ensureAuthenticated, ensureAdmin, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM products ORDER BY created_at DESC LIMIT 200');
  res.render('admin/products', { title: 'Admin - Produk', products: rows });
});

router.get('/admin/products/new', ensureAuthenticated, ensureAdmin, (req, res) => {
  res.render('admin/product_form', { title: 'Tambah Produk', product: null });
});

router.post('/admin/products/new', ensureAuthenticated, ensureAdmin,
  upload.single('image'), csrfProtection,
  body('name').trim().isLength({ min: 2 }),
  body('price').isFloat({ min: 0 }),
  body('stock').isInt({ min: 0 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('admin/product_form', { title: 'Tambah Produk', errors: errors.array(), product: req.body });
    }
    let imageUrl = null;
    if (req.file) {
      const processed = await processImage(req.file.path);
      imageUrl = processed.replace(process.cwd(), '').replace(/\\\\/g, '/').replace(/\\/g, '/');
      if (imageUrl.startsWith('/')) imageUrl = imageUrl.substring(1);
    }
    const { name, description = '', price, stock, category = '' } = req.body;
    await pool.query('INSERT INTO products (name, description, price, stock, image_url, category) VALUES (?, ?, ?, ?, ?, ?)', [name, description, price, stock, imageUrl, category]);
    res.redirect('/admin/products');
  }
);

router.get('/admin/products/:id/edit', ensureAuthenticated, ensureAdmin, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM products WHERE id = ? LIMIT 1', [req.params.id]);
  if (rows.length === 0) return res.status(404).send('Produk tidak ditemukan');
  res.render('admin/product_form', { title: 'Edit Produk', product: rows[0] });
});

router.post('/admin/products/:id/edit', ensureAuthenticated, ensureAdmin,
  upload.single('image'), csrfProtection,
  body('name').trim().isLength({ min: 2 }),
  body('price').isFloat({ min: 0 }),
  body('stock').isInt({ min: 0 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const product = { id: req.params.id, ...req.body };
      return res.status(400).render('admin/product_form', { title: 'Edit Produk', errors: errors.array(), product });
    }
    let imageUrl = req.body.existing_image_url || null;
    if (req.file) {
      const processed = await processImage(req.file.path);
      imageUrl = processed.replace(process.cwd(), '').replace(/\\\\/g, '/').replace(/\\/g, '/');
      if (imageUrl.startsWith('/')) imageUrl = imageUrl.substring(1);
    }
    const { name, description = '', price, stock, category = '', is_active = '1' } = req.body;
    await pool.query(
      'UPDATE products SET name = ?, description = ?, price = ?, stock = ?, image_url = ?, category = ?, is_active = ? WHERE id = ? LIMIT 1',
      [name, description, price, stock, imageUrl, category, Number(is_active) ? 1 : 0, req.params.id]
    );
    res.redirect('/admin/products');
  }
);

router.post('/admin/products/:id/delete', ensureAuthenticated, ensureAdmin, async (req, res) => {
  // Soft delete: set is_active = 0
  await pool.query('UPDATE products SET is_active = 0 WHERE id = ? LIMIT 1', [req.params.id]);
  res.redirect('/admin/products');
});

module.exports = router;
