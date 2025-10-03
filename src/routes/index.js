const express = require("express");
const authRoutes = require("./auth");
const productRoutes = require("./products");
const cartRoutes = require("./cart");
const checkoutRoutes = require("./checkout");
const adminRoutes = require("./admin");

const router = express.Router();

router.use(authRoutes);
router.use(productRoutes);
router.use(cartRoutes);
router.use(checkoutRoutes);
router.use(adminRoutes);

module.exports = router;
