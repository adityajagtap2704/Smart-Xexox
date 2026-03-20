import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { orderAPI, shopAPI, paymentAPI } from '@/lib/api';
import { onOrderUpdate, joinOrderRoom } from '@/lib/socket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Upload, FileText, Package, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

const statusColors = {
  pending: 'bg-warning/10 text-warning',
  accepted: 'bg-info/10 text-info',
  printing: 'bg-primary/10 text-primary',
  ready: 'bg-success/10 text-success',
  completed: 'bg-success/10 text-success',
  cancelled: 'bg-destructive/10 text-destructive',
};

const UserDashboard = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [shops, setShops] = useState([]);
  const [activeTab, setActiveTab] = useState('orders');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  // New order form
  const [file, setFile] = useState(null);
  const [copies, setCopies] = useState(1);
  const [colorType, setColorType] = useState('bw');
  const [paperSize, setPaperSize] = useState('A4');
  const [selectedShop, setSelectedShop] = useState('');
  const [doubleSided, setDoubleSided] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await orderAPI.getMyOrders();
      setOrders(res.data.orders || res.data || []);
    } catch { /* */ }
  }, []);

  const fetchShops = useCallback(async () => {
    try {
      const res = await shopAPI.getAll();
      setShops(res.data.shops || res.data || []);
    } catch { /* */ }
  }, []);

  useEffect(() => {
    Promise.all([fetchOrders(), fetchShops()]).finally(() => setLoading(false));
  }, [fetchOrders, fetchShops]);

  useEffect(() => {
    const cleanup = onOrderUpdate((data) => {
      setOrders((prev) => prev.map((o) => (o._id === data.orderId ? { ...o, status: data.status } : o)));
      toast.info(`Order updated: ${data.status}`);
    });
    return cleanup;
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !selectedShop) {
      toast.error('Please select a file and shop');
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('copies', copies.toString());
      formData.append('colorType', colorType);
      formData.append('paperSize', paperSize);
      formData.append('shopId', selectedShop);
      formData.append('doubleSided', doubleSided.toString());

      const res = await orderAPI.create(formData);
      const order = res.data.order || res.data;

      if (order.totalCost && order.totalCost > 0) {
        try {
          const payRes = await paymentAPI.createOrder({ amount: order.totalCost, orderId: order._id });
          const razorpayOrder = payRes.data;

          const options = {
            key: import.meta.env.VITE_RAZORPAY_KEY || 'rzp_test_key',
            amount: razorpayOrder.amount,
            currency: 'INR',
            name: 'Smart Xerox',
            description: 'Document Printing',
            order_id: razorpayOrder.id,
            handler: async (response) => {
              await paymentAPI.verify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                orderId: order._id,
              });
              toast.success('Payment successful!');
              fetchOrders();
              setActiveTab('orders');
            },
            prefill: { name: user?.name, email: user?.email, contact: user?.phone },
          };
          const rzp = new window.Razorpay(options);
          rzp.open();
        } catch {
          toast.error('Payment initiation failed');
        }
      } else {
        toast.success('Order placed successfully!');
        fetchOrders();
        setActiveTab('orders');
      }

      setFile(null);
      setCopies(1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  const estimatedCost = () => {
    const rate = colorType === 'color' ? 5 : 1;
    return (rate * copies * 1).toFixed(2);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold">Hello, {user?.name} 👋</h1>
          <p className="text-muted-foreground">Manage your printing orders</p>
        </div>

        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setActiveTab('orders')}
            className={`rounded-xl px-5 py-2.5 text-sm font-medium transition-all ${activeTab === 'orders' ? 'sunrise-gradient text-primary-foreground sunrise-shadow-sm' : 'bg-secondary text-secondary-foreground'}`}
          >
            My Orders
          </button>
          <button
            onClick={() => setActiveTab('new')}
            className={`rounded-xl px-5 py-2.5 text-sm font-medium transition-all ${activeTab === 'new' ? 'sunrise-gradient text-primary-foreground sunrise-shadow-sm' : 'bg-secondary text-secondary-foreground'}`}
          >
            New Order
          </button>
        </div>

        {activeTab === 'new' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 max-w-2xl">
            <h2 className="font-heading text-xl font-semibold mb-6">Place New Order</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label>Upload Document (PDF)</Label>
                <div className="mt-1.5 border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
                  <input type="file" accept=".pdf,.doc,.docx,.jpg,.png" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" id="file-upload" />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">{file ? file.name : 'Click to upload or drag & drop'}</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, DOC, JPG, PNG (Max 20MB)</p>
                  </label>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Copies</Label>
                  <Input type="number" min={1} max={100} value={copies} onChange={(e) => setCopies(Number(e.target.value))} className="mt-1.5" />
                </div>
                <div>
                  <Label>Color Type</Label>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    {['bw', 'color'].map((t) => (
                      <button key={t} type="button" onClick={() => setColorType(t)} className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${colorType === t ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                        {t === 'bw' ? 'B&W' : 'Color'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Paper Size</Label>
                  <div className="mt-1.5 grid grid-cols-3 gap-2">
                    {['A4', 'A3', 'Letter'].map((s) => (
                      <button key={s} type="button" onClick={() => setPaperSize(s)} className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${paperSize === s ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Print Sides</Label>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    {[false, true].map((d) => (
                      <button key={String(d)} type="button" onClick={() => setDoubleSided(d)} className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${doubleSided === d ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                        {d ? 'Double' : 'Single'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <Label>Select Shop</Label>
                <select value={selectedShop} onChange={(e) => setSelectedShop(e.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" required>
                  <option value="">Choose a shop...</option>
                  {shops.map((s) => (
                    <option key={s._id} value={s._id}>{s.name} {s.address ? `- ${s.address}` : ''}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-secondary p-4">
                <span className="font-medium">Estimated Cost</span>
                <span className="font-heading text-xl font-bold text-primary">₹{estimatedCost()}</span>
              </div>

              <Button type="submit" className="w-full sunrise-gradient text-primary-foreground sunrise-shadow-sm" disabled={submitting}>
                {submitting ? 'Placing Order...' : 'Place Order & Pay'}
              </Button>
            </form>
          </motion.div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Loading orders...</div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12">
                <Package className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No orders yet</p>
                <Button className="mt-4 sunrise-gradient text-primary-foreground" onClick={() => setActiveTab('new')}>Place Your First Order</Button>
              </div>
            ) : (
              orders.map((order, i) => (
                <motion.div
                  key={order._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-card p-5 cursor-pointer hover:sunrise-shadow-sm transition-all"
                  onClick={() => { setSelectedOrder(order); joinOrderRoom(order._id); }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{order.fileName || `Order #${order._id.slice(-6)}`}</p>
                        <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColors[order.status] || 'bg-muted text-muted-foreground'}`}>
                        {order.status}
                      </span>
                      {order.totalCost && <span className="font-heading font-bold text-primary">₹{order.totalCost}</span>}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* Order detail modal */}
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-sm p-4" onClick={() => setSelectedOrder(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading text-lg font-semibold">Order Details</h3>
                <button onClick={() => setSelectedOrder(null)}><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Order ID</span><span className="font-medium">#{selectedOrder._id.slice(-8)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[selectedOrder.status]}`}>{selectedOrder.status}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Copies</span><span>{selectedOrder.copies}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Color</span><span>{selectedOrder.colorType}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Paper</span><span>{selectedOrder.paperSize}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Cost</span><span className="font-bold text-primary">₹{selectedOrder.totalCost}</span></div>
                {selectedOrder.shopId && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Shop</span><span>{selectedOrder.shopId.name}</span></div>
                )}
              </div>
              {selectedOrder.pickupCode && (
                <div className="mt-6 text-center">
                  <p className="text-sm text-muted-foreground mb-2">Pickup Code</p>
                  <p className="font-heading text-3xl font-bold text-primary tracking-wider">{selectedOrder.pickupCode}</p>
                </div>
              )}
              {(selectedOrder.qrCode || selectedOrder.status === 'ready') && (
                <div className="mt-4 flex justify-center">
                  <QRCodeSVG value={selectedOrder.qrCode || selectedOrder._id} size={160} />
                </div>
              )}
            </motion.div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default UserDashboard;
