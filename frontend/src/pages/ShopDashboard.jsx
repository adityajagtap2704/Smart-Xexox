import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { shopAPI, orderAPI } from '@/lib/api';
import { onOrderUpdate } from '@/lib/socket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

const statusActions = {
  pending: { next: 'accepted', label: 'Accept', color: 'bg-blue-500 text-white' },
  accepted: { next: 'printing', label: 'Start Printing', color: 'bg-primary text-primary-foreground' },
  printing: { next: 'ready', label: 'Mark Ready', color: 'bg-green-500 text-white' },
  ready: { next: 'completed', label: 'Complete', color: 'bg-green-600 text-white' },
};

const ShopDashboard = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('incoming');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyOrderId, setVerifyOrderId] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await shopAPI.getShopOrders();
      setOrders(res.data.orders || res.data || []);
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    const cleanup = onOrderUpdate(() => fetchOrders());
    return cleanup;
  }, [fetchOrders]);

  const updateStatus = async (orderId, status) => {
    try {
      await orderAPI.updateStatus(orderId, status);
      toast.success(`Order ${status}`);
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    }
  };

  const handleVerify = async () => {
    try {
      await orderAPI.verifyPickup(verifyOrderId, { pickupCode: verifyCode });
      toast.success('Pickup verified!');
      setVerifyCode('');
      setVerifyOrderId('');
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed');
    }
  };

  const filterOrders = (statuses) => orders.filter((o) => statuses.includes(o.status));

  const tabs = [
    { key: 'incoming', label: 'Incoming', count: filterOrders(['pending']).length },
    { key: 'active', label: 'Active', count: filterOrders(['accepted', 'printing', 'ready']).length },
    { key: 'completed', label: 'Completed', count: filterOrders(['completed']).length },
    { key: 'settings', label: 'Settings', count: 0 },
  ];

  const getTabOrders = () => {
    if (activeTab === 'incoming') return filterOrders(['pending']);
    if (activeTab === 'active') return filterOrders(['accepted', 'printing', 'ready']);
    return filterOrders(['completed']);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold">Shop Dashboard 🏪</h1>
          <p className="text-muted-foreground">Manage incoming print orders</p>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${activeTab === t.key ? 'sunrise-gradient text-primary-foreground sunrise-shadow-sm' : 'bg-secondary text-secondary-foreground'}`}
            >
              {t.label} {t.count > 0 && <span className="ml-1 rounded-full bg-primary-foreground/20 px-1.5 text-xs">{t.count}</span>}
            </button>
          ))}
        </div>

        {activeTab === 'settings' ? (
          <div className="glass-card p-6 max-w-lg">
            <h2 className="font-heading text-xl font-semibold mb-4">QR / Pickup Verification</h2>
            <div className="space-y-4">
              <div>
                <Label>Order ID</Label>
                <Input placeholder="Enter order ID" value={verifyOrderId} onChange={(e) => setVerifyOrderId(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>Pickup Code</Label>
                <Input placeholder="Enter 6-digit code" value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} className="mt-1.5" maxLength={6} />
              </div>
              <Button onClick={handleVerify} className="sunrise-gradient text-primary-foreground">Verify Pickup</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            ) : (
              <>
                {getTabOrders().map((order, i) => (
                  <motion.div
                    key={order._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass-card p-5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <p className="font-medium">{order.fileName || `Order #${order._id.slice(-6)}`}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {order.userId?.name} • {order.copies} copies • {order.colorType} • {order.paperSize}
                        </p>
                        <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {order.totalCost && <span className="font-heading font-bold text-primary">₹{order.totalCost}</span>}
                        {statusActions[order.status] && (
                          <Button
                            size="sm"
                            className={statusActions[order.status].color}
                            onClick={() => updateStatus(order._id, statusActions[order.status].next)}
                          >
                            {statusActions[order.status].label}
                          </Button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
                {getTabOrders().length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">No orders in this category</div>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default ShopDashboard;
