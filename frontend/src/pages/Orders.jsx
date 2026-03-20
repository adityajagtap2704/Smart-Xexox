import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { orderAPI } from '@/lib/api';
import { onOrderUpdate, joinOrderRoom } from '@/lib/socket';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { FileText, CheckCircle, X, RefreshCw } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

const statusSteps = ['pending', 'accepted', 'printing', 'ready', 'completed'];

const Orders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    orderAPI.getMyOrders()
      .then((res) => setOrders(res.data.orders || res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const cleanup = onOrderUpdate((data) => {
      setOrders((prev) => prev.map((o) => (o._id === data.orderId ? { ...o, status: data.status } : o)));
      toast.info(`Order ${data.orderId.slice(-6)} → ${data.status}`);
    });
    return cleanup;
  }, []);

  useEffect(() => {
    orders.forEach((o) => {
      if (!['completed', 'cancelled'].includes(o.status)) joinOrderRoom(o._id);
    });
  }, [orders]);

  const handleExtend = async (id) => {
    try {
      await orderAPI.extendExpiry(id);
      toast.success('Expiry extended by 12 hours');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="font-heading text-3xl font-bold mb-6">My Orders</h1>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No orders yet</div>
        ) : (
          <div className="space-y-4">
            {orders.map((order, i) => (
              <motion.div
                key={order._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card p-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{order.fileName || `#${order._id.slice(-6)}`}</p>
                      <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-heading font-bold text-primary">₹{order.totalCost || 0}</span>
                    {order.status === 'ready' && (
                      <Button size="sm" variant="outline" onClick={() => setSelected(order)}>
                        Show QR
                      </Button>
                    )}
                    {order.status === 'ready' && (
                      <Button size="sm" variant="ghost" onClick={() => handleExtend(order._id)}>
                        <RefreshCw className="h-3 w-3 mr-1" /> Extend
                      </Button>
                    )}
                  </div>
                </div>

                {/* Status tracker */}
                <div className="mt-4 flex items-center gap-1 overflow-x-auto">
                  {statusSteps.map((step, si) => {
                    const currentIdx = statusSteps.indexOf(order.status);
                    const done = si <= currentIdx;
                    return (
                      <div key={step} className="flex items-center">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${done ? 'sunrise-gradient text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                          {done ? <CheckCircle className="h-3.5 w-3.5" /> : si + 1}
                        </div>
                        {si < statusSteps.length - 1 && <div className={`h-0.5 w-6 sm:w-10 ${done ? 'bg-primary' : 'bg-muted'}`} />}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-1 flex gap-1 text-[10px] text-muted-foreground overflow-x-auto">
                  {statusSteps.map((s) => <span key={s} className="min-w-[52px] text-center capitalize">{s}</span>)}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-sm p-4" onClick={() => setSelected(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-8 text-center max-w-sm relative" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setSelected(null)} className="absolute top-3 right-3"><X className="h-5 w-5" /></button>
              <h3 className="font-heading text-lg font-semibold mb-2">Pickup QR Code</h3>
              <p className="text-sm text-muted-foreground mb-4">Show this to the shopkeeper</p>
              <QRCodeSVG value={selected.qrCode || selected._id} size={200} className="mx-auto" />
              {selected.pickupCode && (
                <p className="mt-4 font-heading text-2xl font-bold text-primary tracking-widest">{selected.pickupCode}</p>
              )}
            </motion.div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Orders;
