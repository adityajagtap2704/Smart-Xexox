// shop.routes.js
const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shop.controller');
const { protect, restrictTo } = require('../middleware/auth');

router.get('/', shopController.getAllShops);
router.get('/nearby', shopController.getNearbyShops);
router.get('/:id', shopController.getShop);
router.get('/:id/reviews', shopController.getShopReviews);

router.use(protect);
router.post('/', restrictTo('shopkeeper'), shopController.createShop);
router.patch('/my-shop', restrictTo('shopkeeper'), shopController.updateShop);
router.get('/my-shop/dashboard', restrictTo('shopkeeper'), shopController.getShopDashboard);
router.patch('/my-shop/toggle-status', restrictTo('shopkeeper'), shopController.toggleShopStatus);

module.exports = router;
