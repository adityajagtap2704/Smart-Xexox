const Order = require('../models/Order');
const Shop = require('../models/Shop');
const User = require('../models/User');
const Payment = require('../models/Payment');
const { AppError, asyncHandler } = require('../utils/helpers');
const { createRazorpayOrder } = require('../config/razorpay');
const { generateQRCode } = require('../utils/qrcode');
const { emitToUser, emitToShop, emitToAdmin } = require('../config/socket');
const { createNotification } = require('../utils/notifications');
const { calculateOrderPrice } = require('../utils/pricing');
const { getPresignedUrl } = require('../config/aws');
const logger = require('../config/logger');
const moment = require('moment');

// ─── Create Order ─────────────────────────────────────────────────────────────
exports.createOrder = asyncHandler(async (req, res) => {
  const { shopId, documents, additionalServices, specialInstructions } = req.body;

  const shop = await Shop.findById(shopId);
  if (!shop) throw new AppError('Shop not found', 404);
  if (!shop.isActive || !shop.isVerified) throw new AppError('Shop is not available', 400);
  if (!shop.isOpen) throw new AppError('Shop is currently closed', 400);

  if (!documents || documents.length === 0) {
    throw new AppError('At least one document is required', 400);
  }

  // Validate documents exist in the order request (they should already be uploaded to S3)
  const { subtotal, documentPrices, additionalCharge, total, shopReceivable, platformMargin } =
    calculateOrderPrice(documents, shop, additionalServices);

  // Build document array with prices
  const orderDocuments = documents.map((doc, i) => ({
    ...doc,
    price: documentPrices[i],
  }));

  // Create Razorpay order first
  const receipt = `order_${Date.now()}`;
  const razorpayOrder = await createRazorpayOrder({
    amount: total,
    currency: 'INR',
    receipt,
    notes: { shopId, userId: req.user.id },
  });

  // Create Order in DB
  const order = await Order.create({
    user: req.user.id,
    shop: shopId,
    documents: orderDocuments,
    additionalServices: additionalServices || {},
    specialInstructions,
    pricing: {
      subtotal,
      platformMargin,
      additionalServicesCharge: additionalCharge,
      total,
      shopReceivable,
    },
    status: 'pending_payment',
    payment: {
      razorpayOrderId: razorpayOrder.id,
      status: 'pending',
    },
    statusHistory: [{ status: 'pending_payment', note: 'Order created, awaiting payment' }],
  });

  // Create payment record
  await Payment.create({
    order: order._id,
    user: req.user.id,
    shop: shopId,
    razorpayOrderId: razorpayOrder.id,
    amount: total,
    shopReceivable,
    platformRevenue: platformMargin,
    currency: 'INR',
    receipt,
  });

  res.status(201).json({
    success: true,
    message: 'Order created successfully',
    data: {
      order,
      razorpay: {
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        key: process.env.RAZORPAY_KEY_ID,
      },
    },
  });
});

// ─── Get User Orders ──────────────────────────────────────────────────────────
exports.getUserOrders = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const filter = { user: req.user.id };
  if (status) filter.status = status;

  const skip = (page - 1) * limit;
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('shop', 'name address phone rating')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Order.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
      orders,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
    },
  });
});

// ─── Get Single Order ─────────────────────────────────────────────────────────
exports.getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('user', 'name email phone')
    .populate('shop', 'name address phone email');

  if (!order) throw new AppError('Order not found', 404);

  const isOwner = order.user._id.toString() === req.user.id;
  const isShopOwner = req.user.role === 'shopkeeper';
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isShopOwner && !isAdmin) {
    throw new AppError('Access denied', 403);
  }

  // Generate fresh presigned URLs for documents
  if (isOwner || isAdmin) {
    for (const doc of order.documents) {
      if (doc.s3Key) {
        doc.downloadUrl = await getPresignedUrl(doc.s3Key, 900); // 15 min
      }
    }
  }

  res.status(200).json({ success: true, data: { order } });
});

// ─── Get Shop Orders ──────────────────────────────────────────────────────────
exports.getShopOrders = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10, date } = req.query;

  // Verify shopkeeper owns the shop
  const shop = await Shop.findOne({ owner: req.user.id });
  if (!shop) throw new AppError('Shop not found for this account', 404);

  const filter = { shop: shop._id };
  if (status) filter.status = status;
  if (date) {
    const startOfDay = moment(date).startOf('day').toDate();
    const endOfDay = moment(date).endOf('day').toDate();
    filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
  }
  // Only show paid orders to shop
  if (!filter.status) {
    filter.status = { $nin: ['pending_payment'] };
  }

  const skip = (page - 1) * limit;
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('user', 'name phone email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Order.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
      orders,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
    },
  });
});

// ─── Accept Order ─────────────────────────────────────────────────────────────
exports.acceptOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('shop');
  if (!order) throw new AppError('Order not found', 404);
  if (order.shop.owner.toString() !== req.user.id) throw new AppError('Access denied', 403);
  if (order.status !== 'paid') throw new AppError('Order cannot be accepted in current state', 400);

  order.addStatusHistory('accepted', 'Order accepted by shopkeeper', req.user.id);
  order.expiry.expiresAt = moment().add(parseInt(process.env.ORDER_EXPIRY_HOURS) || 12, 'hours').toDate();
  await order.save();

  // Notify user
  await createNotification({
    recipient: order.user,
    type: 'order_accepted',
    title: 'Order Accepted! 🎉',
    message: `Your order #${order.orderNumber} has been accepted. Ready soon!`,
    order: order._id,
  });
  emitToUser(order.user.toString(), 'order:status_update', { orderId: order._id, status: 'accepted', orderNumber: order.orderNumber });

  res.status(200).json({ success: true, message: 'Order accepted', data: { order } });
});

// ─── Reject Order ─────────────────────────────────────────────────────────────
exports.rejectOrder = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const order = await Order.findById(req.params.id).populate('shop');
  if (!order) throw new AppError('Order not found', 404);
  if (order.shop.owner.toString() !== req.user.id) throw new AppError('Access denied', 403);
  if (!['paid'].includes(order.status)) throw new AppError('Cannot reject order in current state', 400);

  order.addStatusHistory('rejected', reason || 'Rejected by shopkeeper', req.user.id);
  order.rejectionReason = reason;
  await order.save();

  // TODO: Trigger refund via Razorpay

  await createNotification({
    recipient: order.user,
    type: 'order_rejected',
    title: 'Order Rejected',
    message: `Your order #${order.orderNumber} was rejected. Reason: ${reason || 'Not specified'}. Refund will be processed.`,
    order: order._id,
  });
  emitToUser(order.user.toString(), 'order:status_update', { orderId: order._id, status: 'rejected', reason });

  res.status(200).json({ success: true, message: 'Order rejected', data: { order } });
});

// ─── Update Order Status (Shop) ───────────────────────────────────────────────
exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  const validTransitions = {
    accepted: ['printing'],
    printing: ['ready'],
  };

  const order = await Order.findById(req.params.id).populate('shop');
  if (!order) throw new AppError('Order not found', 404);
  if (order.shop.owner.toString() !== req.user.id) throw new AppError('Access denied', 403);

  const allowed = validTransitions[order.status];
  if (!allowed || !allowed.includes(status)) {
    throw new AppError(`Cannot transition from ${order.status} to ${status}`, 400);
  }

  order.addStatusHistory(status, note, req.user.id);
  await order.save();

  const notifData = {
    printing: { title: 'Printing Started 🖨️', message: `Your order #${order.orderNumber} is being printed!`, type: 'order_printing' },
    ready: { title: 'Order Ready for Pickup! ✅', message: `Your order #${order.orderNumber} is ready. Show your QR code to collect.`, type: 'order_ready' },
  };

  if (notifData[status]) {
    await createNotification({ recipient: order.user, ...notifData[status], order: order._id });
  }

  emitToUser(order.user.toString(), 'order:status_update', { orderId: order._id, status, orderNumber: order.orderNumber });

  res.status(200).json({ success: true, message: `Order status updated to ${status}`, data: { order } });
});

// ─── Verify QR / Pickup Code ──────────────────────────────────────────────────
exports.verifyPickup = asyncHandler(async (req, res) => {
  const { orderId, pickupCode, qrData } = req.body;

  const order = await Order.findById(orderId).populate('shop');
  if (!order) throw new AppError('Order not found', 404);
  if (order.shop.owner.toString() !== req.user.id) throw new AppError('Access denied', 403);
  if (order.status !== 'ready') throw new AppError('Order is not ready for pickup', 400);

  // Verify via pickup code or QR data
  const validCode = pickupCode && order.pickup.pickupCode === pickupCode;
  const validQR = qrData && order.pickup.qrCodeData === qrData;

  if (!validCode && !validQR) {
    throw new AppError('Invalid pickup code or QR code', 400);
  }

  order.addStatusHistory('picked_up', 'Order picked up by customer', req.user.id);
  order.pickup.verifiedAt = new Date();
  order.pickup.verifiedBy = req.user.id;
  await order.save();

  // Update shop stats
  await Shop.findByIdAndUpdate(order.shop._id, {
    $inc: { totalOrders: 1, totalRevenue: order.pricing.shopReceivable },
  });
  await User.findByIdAndUpdate(order.user, {
    $inc: { totalOrders: 1, totalSpent: order.pricing.total },
  });

  await createNotification({
    recipient: order.user,
    type: 'order_picked_up',
    title: 'Order Collected! 🎊',
    message: `Your order #${order.orderNumber} has been collected. Thank you!`,
    order: order._id,
  });
  emitToUser(order.user.toString(), 'order:status_update', { orderId: order._id, status: 'picked_up' });

  res.status(200).json({ success: true, message: 'Order pickup verified successfully', data: { order } });
});

// ─── Extend Order Expiry ──────────────────────────────────────────────────────
exports.extendOrderExpiry = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user.id });
  if (!order) throw new AppError('Order not found', 404);
  if (order.expiry.extended) throw new AppError('Order expiry already extended once', 400);
  if (!['paid', 'accepted', 'printing', 'ready'].includes(order.status)) {
    throw new AppError('Cannot extend order in current state', 400);
  }

  const extensionHours = parseInt(process.env.ORDER_EXTENSION_HOURS) || 12;
  order.expiry.expiresAt = moment(order.expiry.expiresAt).add(extensionHours, 'hours').toDate();
  order.expiry.extended = true;
  order.expiry.extendedAt = new Date();
  order.expiry.extendedBy = req.user.id;
  order.addStatusHistory('', `Order expiry extended by ${extensionHours} hours`, req.user.id);
  await order.save();

  emitToShop(order.shop.toString(), 'order:extended', { orderId: order._id, newExpiry: order.expiry.expiresAt });

  res.status(200).json({ success: true, message: `Order extended by ${extensionHours} hours`, data: { order } });
});

// ─── Rate Order ───────────────────────────────────────────────────────────────
exports.rateOrder = asyncHandler(async (req, res) => {
  const { rating, review } = req.body;
  const order = await Order.findOne({ _id: req.params.id, user: req.user.id });
  if (!order) throw new AppError('Order not found', 404);
  if (order.status !== 'picked_up') throw new AppError('Can only rate completed orders', 400);
  if (order.rating?.score) throw new AppError('Already rated this order', 400);

  order.rating = { score: rating, review, ratedAt: new Date() };
  await order.save();

  const Review = require('../models/Review');
  await Review.create({ user: req.user.id, shop: order.shop, order: order._id, rating, review });

  res.status(200).json({ success: true, message: 'Thank you for your rating!', data: { order } });
});

// ─── Get Document Download URL ────────────────────────────────────────────────
exports.getDocumentUrl = asyncHandler(async (req, res) => {
  const { orderId, docId } = req.params;
  const order = await Order.findById(orderId).populate('shop');
  if (!order) throw new AppError('Order not found', 404);

  const isShopOwner = order.shop.owner.toString() === req.user.id;
  const isAdmin = req.user.role === 'admin';
  if (!isShopOwner && !isAdmin) throw new AppError('Access denied', 403);

  if (!['accepted', 'printing', 'ready'].includes(order.status)) {
    throw new AppError('Document not available in current order state', 400);
  }

  const doc = order.documents.id(docId);
  if (!doc) throw new AppError('Document not found', 404);

  const url = await getPresignedUrl(doc.s3Key, 900); // 15 min URL

  // Mark downloaded
  doc.downloadedByShop = true;
  doc.downloadedAt = new Date();
  await order.save();

  res.status(200).json({ success: true, data: { downloadUrl: url, expiresIn: 900 } });
});
