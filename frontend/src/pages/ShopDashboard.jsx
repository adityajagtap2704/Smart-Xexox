import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { shopAPI, orderAPI } from '@/lib/api';
import { onOrderUpdate, getSocket } from '@/lib/socket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Printer, Clock, History, CheckCircle2, XCircle, ChevronDown, ChevronUp, Download } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

// ─── Status visual config ─────────────────────────────────────────────────────
const statusBadge = {
  paid:      'bg-blue-100 text-blue-800 border border-blue-200',
  accepted:  'bg-indigo-100 text-indigo-800 border border-indigo-200',
  printing:  'bg-purple-100 text-purple-800 border border-purple-200',
  ready:     'bg-green-100 text-green-800 border border-green-200',
  picked_up: 'bg-gray-100 text-gray-600 border border-gray-200',
  rejected:  'bg-red-100 text-red-800 border border-red-200',
  cancelled: 'bg-red-50 text-red-600 border border-red-100',
};

const statusLabel = {
  paid:      '🟦 Queued',
  accepted:  '🔵 Accepted',
  printing:  '🟣 Printing',
  ready:     '🟢 Ready for Pickup',
  picked_up: '✅ Collected',
  rejected:  '❌ Rejected',
  cancelled: '❌ Cancelled',
};

const ShopDashboard = () => {
  const { user } = useAuth();
  const [orders, setOrders]         = useState([]);
  const [activeTab, setActiveTab]   = useState('queue');
  const [loading, setLoading]       = useState(true);
  const [myShop, setMyShop]         = useState(null);

  // Which "ready" order row is expanded for OTP entry
  const [expandedId, setExpandedId] = useState(null);
  // OTP typed by shopkeeper for each order (keyed by orderId)
  const [otpValues, setOtpValues]   = useState({});
  const [verifying, setVerifying]   = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    try {
      const res = await shopAPI.getShopOrders();
      setOrders(res.data.data?.orders || res.data.orders || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  const fetchShop = useCallback(async () => {
    try {
      const res = await shopAPI.getMyShop();
      const shop = res.data.data?.shop || res.data.shop || res.data;
      setMyShop(shop);
      // Join shop socket room so we receive order:new events
      if (shop?._id) {
        getSocket().emit('join:shop', shop._id);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchShop();
    fetchOrders();
  }, [fetchShop, fetchOrders]);

  // ── Real-time order updates ────────────────────────────────────────────────
  useEffect(() => {
    // Refresh list whenever any order status changes
    const cleanup = onOrderUpdate(() => fetchOrders());
    return cleanup;
  }, [fetchOrders]);

  useEffect(() => {
    const s = getSocket();
    const onNew = () => { toast.info('🆕 New order received!'); fetchOrders(); };
    s.on('order:new', onNew);
    return () => s.off('order:new', onNew);
  }, [fetchOrders]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const updateStatus = async (orderId, status) => {
    try {
      if (status === 'accepted') {
        await orderAPI.accept(orderId);
      } else {
        await orderAPI.updateStatus(orderId, status);
      }
      toast.success(`Order marked as ${statusLabel[status] || status}`);
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  };

  // Shopkeeper sees OTP on screen, customer shows OTP, shopkeeper types it and clicks Done
  const handleVerifyAndDone = async (orderId) => {
    const code = otpValues[orderId] || '';
    if (code.length !== 6) {
      toast.error('Enter the full 6-digit OTP shown by the customer');
      return;
    }
    setVerifying(true);
    try {
      await orderAPI.verifyPickup({ orderId, pickupCode: code });
      toast.success('✅ OTP matched! Order marked as Done and moved to history.');
      setExpandedId(null);
      setOtpValues(prev => { const n = { ...prev }; delete n[orderId]; return n; });
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'OTP does not match. Please check again.');
    } finally {
      setVerifying(false);
    }
  };

  // Download document from S3 signed URL
  const handleDownload = async (orderId, docId) => {
    try {
      const res = await orderAPI.getDocumentUrl(orderId, docId);
      const url = res.data.data?.downloadUrl;
      if (url) window.open(url, '_blank');
    } catch {
      toast.error('Could not get download link');
    }
  };

  // ── Tab filtering ──────────────────────────────────────────────────────────
  const queueOrders   = orders.filter(o => o.status === 'paid');
  const activeOrders  = orders.filter(o => ['accepted', 'printing', 'ready'].includes(o.status));
  const historyOrders = orders.filter(o => ['picked_up', 'rejected', 'cancelled'].includes(o.status));

  const tabs = [
    { key: 'queue',   label: 'Queue',   icon: <Clock className="h-4 w-4" />,    count: queueOrders.length },
    { key: 'active',  label: 'Active',  icon: <Printer className="h-4 w-4" />,  count: activeOrders.length },
    { key: 'history', label: 'History', icon: <History className="h-4 w-4" />,  count: historyOrders.length },
  ];

  const getTabOrders = () => {
    if (activeTab === 'queue')   return queueOrders;
    if (activeTab === 'active')  return activeOrders;
    return historyOrders;
  };

  // ── Action button per status ───────────────────────────────────────────────
  const ActionButton = ({ order }) => {
    if (order.status === 'paid') {
      return (
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => updateStatus(order._id, 'accepted')}>
          Accept Order
        </Button>
      );
    }
    if (order.status === 'accepted') {
      return (
        <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white"
          onClick={() => updateStatus(order._id, 'printing')}>
          Start Printing
        </Button>
      );
    }
    if (order.status === 'printing') {
      return (
        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
          onClick={() => updateStatus(order._id, 'ready')}>
          Mark Ready
        </Button>
      );
    }
    // ready — "Mark Done" triggers OTP entry panel
    if (order.status === 'ready') {
      return (
        <Button
          size="sm"
          className="bg-orange-500 hover:bg-orange-600 text-white"
          onClick={() => setExpandedId(expandedId === order._id ? null : order._id)}
        >
          {expandedId === order._id ? (
            <><ChevronUp className="h-3 w-3 mr-1" />Close</>
          ) : (
            <><CheckCircle2 className="h-3 w-3 mr-1" />Mark Done</>
          )}
        </Button>
      );
    }
    return null;
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold">Shop Dashboard 🏪</h1>
          <p className="text-muted-foreground">{myShop?.name || user?.name}</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all
                ${activeTab === t.key
                  ? 'sunrise-gradient text-primary-foreground sunrise-shadow-sm'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
            >
              {t.icon}
              {t.label}
              {t.count > 0 && (
                <span className="rounded-full bg-white/25 px-1.5 text-xs font-bold">{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Orders */}
        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Loading orders...</div>
        ) : getTabOrders().length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            {activeTab === 'queue'   && 'No new orders waiting'}
            {activeTab === 'active'  && 'No active orders right now'}
            {activeTab === 'history' && 'No completed orders yet'}
          </div>
        ) : (
          <div className="space-y-3">
            {getTabOrders().map((order, i) => (
              <motion.div
                key={order._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="glass-card overflow-hidden"
              >
                {/* ── Main row ─────────────────────────────────────────── */}
                <div className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">

                  {/* Left: order info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">
                        #{order.orderNumber || order._id.slice(-6).toUpperCase()}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge[order.status] || ''}`}>
                        {statusLabel[order.status] || order.status}
                      </span>
                    </div>

                    {/* Customer name */}
                    <p className="text-sm font-medium text-foreground">
                      {order.user?.name || 'Customer'}
                      {order.user?.phone ? ` · ${order.user.phone}` : ''}
                    </p>

                    {/* Document details */}
                    {order.documents?.[0] && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        📄 {order.documents[0].fileName || 'Document'} &bull;{' '}
                        {order.documents[0].copies} {order.documents[0].copies > 1 ? 'copies' : 'copy'} &bull;{' '}
                        {order.documents[0].colorType === 'color' ? '🎨 Color' : '⬛ B&W'} &bull;{' '}
                        {order.documents[0].paperSize}
                        {order.documents[0].doubleSided ? ' · Double-sided' : ''}
                      </p>
                    )}

                    <p className="text-xs text-muted-foreground mt-0.5">
                      🕐 {new Date(order.createdAt).toLocaleString('en-IN')}
                    </p>

                    {/* ── OTP display for "ready" orders ─────────────────
                         Shopkeeper sees this OTP on screen.
                         Customer opens their app → sees the same OTP.
                         Shopkeeper cross-checks manually, then clicks Mark Done.
                    ───────────────────────────────────────────────────── */}
                    {order.status === 'ready' && order.pickup?.pickupCode && (
                      <div className="mt-3 inline-flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 px-4 py-2.5">
                        <div>
                          <p className="text-xs text-green-700 font-semibold uppercase tracking-wide mb-0.5">
                            Customer OTP (shown on their screen)
                          </p>
                          <p className="font-mono text-2xl font-bold text-green-800 tracking-[0.3em]">
                            {order.pickup.pickupCode}
                          </p>
                        </div>
                        <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" />
                      </div>
                    )}

                    {/* Download button — visible to shopkeeper for accepted/printing/ready */}
                    {['accepted', 'printing', 'ready'].includes(order.status) && order.documents?.[0] && (
                      <button
                        className="mt-2 text-xs text-primary underline underline-offset-2 hover:opacity-75 flex items-center gap-1"
                        onClick={() => handleDownload(order._id, order.documents[0]._id)}
                      >
                        <Download className="h-3 w-3" />
                        Download document to print
                      </button>
                    )}
                  </div>

                  {/* Right: cost + action button */}
                  <div className="flex items-center gap-3 shrink-0">
                    {order.pricing?.total != null && (
                      <span className="font-heading font-bold text-primary text-lg">
                        ₹{order.pricing.total}
                      </span>
                    )}
                    <ActionButton order={order} />
                  </div>
                </div>

                {/* ── OTP verify panel (expands on "Mark Done") ────────────
                     Shopkeeper types the OTP the customer shows on their phone.
                     If it matches → order marked picked_up → moves to History.
                ─────────────────────────────────────────────────────────── */}
                <AnimatePresence>
                  {expandedId === order._id && order.status === 'ready' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border bg-orange-50/60 px-5 py-4">
                        <p className="text-sm font-semibold text-orange-900 mb-3">
                          Step 1 — Ask the customer to open their app and show the OTP.<br />
                          Step 2 — Compare with the OTP shown above.<br />
                          Step 3 — Type it below to confirm and hand over the printout.
                        </p>

                        <div className="flex flex-wrap items-end gap-3">
                          <div>
                            <Label className="text-xs font-semibold">
                              Type customer's OTP to confirm
                            </Label>
                            <Input
                              className="mt-1 w-44 text-center font-mono font-bold text-xl tracking-[0.3em]"
                              placeholder="______"
                              maxLength={6}
                              value={otpValues[order._id] || ''}
                              onChange={(e) =>
                                setOtpValues(prev => ({
                                  ...prev,
                                  [order._id]: e.target.value.replace(/\D/g, ''),
                                }))
                              }
                            />
                          </div>

                          <Button
                            className="bg-green-600 hover:bg-green-700 text-white"
                            disabled={verifying || (otpValues[order._id] || '').length !== 6}
                            onClick={() => handleVerifyAndDone(order._id)}
                          >
                            {verifying ? 'Verifying...' : '✅ Confirm & Mark Done'}
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setExpandedId(null);
                              setOtpValues(prev => { const n = { ...prev }; delete n[order._id]; return n; });
                            }}
                          >
                            Cancel
                          </Button>
                        </div>

                        <p className="text-xs text-muted-foreground mt-2">
                          OTP must match exactly. If customer lost their OTP, ask them to check their email.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

              </motion.div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default ShopDashboard;