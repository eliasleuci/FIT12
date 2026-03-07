"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Package, ShoppingCart, BarChart3, Search, Save, X, Trash2, Pencil, User as UserIcon, Phone, MapPin, Download, Share2 } from "lucide-react";

export default function Home() {
  const [activeTab, setActiveTab] = useState("billing");
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [lastSale, setLastSale] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  // New Product Form State
  const [newProduct, setNewProduct] = useState({
    name: "", code: "", categoryId: "", unitType: "kg",
    buyPrice: "", sellPrice: "", stock: "0", baseUnit: "kg",
    conversionFactor: "1",
    newCategoryName: ""
  });

  // Billing & Customer State
  const [cart, setCart] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [customer, setCustomer] = useState({ name: "", phone: "", address: "" });
  const [inventorySearchTerm, setInventorySearchTerm] = useState("");

  const subtotal = cart.reduce((acc, item) => acc + item.subtotal, 0);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchStats();
    fetchSalesHistory();
  }, [dateRange]);

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      const res = await fetch(`/api/stats?${params.toString()}`);
      const data = await res.json();
      if (!data.error) setStats(data);
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  const fetchProducts = async () => {
    const res = await fetch("/api/products");
    const data = await res.json();
    if (!data.error) setProducts(data);
  };

  const fetchCategories = async () => {
    const res = await fetch("/api/categories");
    const data = await res.json();
    if (!data.error) setCategories(data);
  };

  const fetchSalesHistory = async () => {
    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      const res = await fetch(`/api/sales?${params.toString()}`);
      const data = await res.json();
      if (!data.error && Array.isArray(data)) setSalesHistory(data);
    } catch (err) {
      console.error("Error fetching sales history:", err);
    }
  };

  const deleteSale = async (saleId: string) => {
    if (!confirm("¿Eliminar esta factura? El stock de los productos será restaurado.")) return;
    const res = await fetch(`/api/sales/${saleId}`, { method: 'DELETE' });
    if (res.ok) {
      fetchSalesHistory();
      fetchStats();
      fetchProducts();
    } else {
      const err = await res.json();
      alert(err.error || "Error al eliminar la venta");
    }
  };

  const resetNewProduct = () => ({
    name: "", code: "", categoryId: "", unitType: "kg",
    buyPrice: "", sellPrice: "", stock: "0", baseUnit: "kg",
    conversionFactor: "1", newCategoryName: ""
  });

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingProduct ? `/api/products/${editingProduct.id}` : "/api/products";
    const method = editingProduct ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newProduct,
        newCategoryName: newProduct.categoryId === "new" ? newProduct.newCategoryName : undefined
      }),
    });
    if (res.ok) {
      setShowAddProduct(false);
      setEditingProduct(null);
      fetchProducts();
      fetchCategories();
      setNewProduct(resetNewProduct());
    }
  };

  const handleOpenEdit = (product: any) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name,
      code: product.code || "",
      categoryId: product.categoryId,
      unitType: product.unitType,
      buyPrice: product.buyPrice.toString(),
      sellPrice: product.sellPrice.toString(),
      stock: product.stock.toString(),
      baseUnit: product.baseUnit,
      conversionFactor: product.conversionFactor?.toString() || "1",
      newCategoryName: ""
    });
    setShowAddProduct(true);
  };

  const handleDeleteProduct = async (product: any) => {
    if (!confirm(`¿Estás seguro de eliminar "${product.name}"? Esta acción no se puede deshacer.`)) return;
    const res = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
    if (res.ok) {
      fetchProducts();
    } else {
      const data = await res.json();
      alert(data.error || "Error al eliminar el producto");
    }
  };

  useEffect(() => {
    if (searchTerm.length > 1) {
      const filtered = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.code && p.code.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setSearchResults(filtered);
    } else {
      setSearchResults([]);
    }
  }, [searchTerm, products]);

  const getAvailableStock = (product: any) => {
    // Stock is stored in baseUnit (e.g. kg). Return in sell unit.
    const cf = product.conversionFactor || 1;
    // If baseUnit === 'g' and unitType = 'kg', cf=1000: availableKg = stock/1000
    // If baseUnit === 'kg' and unitType = 'kg', cf=1: availableKg = stock/1
    // If baseUnit === 'u'  and unitType = 'unit', cf=1: available units = stock/1
    return product.stock / cf;
  };

  const addToCart = (product: any) => {
    const availableStock = getAvailableStock(product);
    const existing = cart.find(item => item.productId === product.id);
    const currentInCart = existing ? (parseFloat(existing.quantity) || 0) : 0;
    const step = product.unitType === 'kg' ? 0.05 : 1;

    if (availableStock <= 0) {
      alert(`⚠️ Sin stock disponible para "${product.name}"`);
      setSearchTerm("");
      return;
    }
    if (currentInCart + step > availableStock) {
      alert(`⚠️ Stock insuficiente para "${product.name}". Disponible: ${availableStock.toFixed(product.unitType === 'kg' ? 3 : 0)} ${product.unitType === 'kg' ? 'kg' : 'u'}`);
      setSearchTerm("");
      return;
    }

    if (existing) {
      updateCartQuantity(product.id, (currentInCart + step).toString(), product);
    } else {
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        price: product.sellPrice,
        quantity: step,
        subtotal: product.sellPrice * step,
        unitType: product.unitType,
        availableStock: availableStock
      }]);
    }
    setSearchTerm("");
  };

  const updateCartQuantity = (id: string, qtyValue: string, productOverride?: any) => {
    setCart(prev => prev.map(item => {
      if (item.productId === id) {
        const qty = qtyValue === "" ? 0 : parseFloat(qtyValue);
        const newQty = isNaN(qty) ? 0 : qty;
        // Get stock limit
        const product = productOverride || products.find((p: any) => p.id === id);
        const available = product ? getAvailableStock(product) : Infinity;
        if (newQty > available && available !== Infinity) {
          alert(`⚠️ Stock insuficiente. Disponible: ${available.toFixed(product?.unitType === 'kg' ? 3 : 0)} ${product?.unitType === 'kg' ? 'kg' : 'u'}`);
          return item; // don't update
        }
        return { ...item, quantity: qtyValue === "" ? "" : newQty, subtotal: (typeof newQty === 'number' ? newQty : 0) * item.price };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.productId !== id));
  };

  const processSale = async (type: string) => {
    if (cart.length === 0) return;

    const res = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        items: cart,
        sellerId: "seller-1",
        customerName: customer.name,
        customerPhone: customer.phone,
        customerAddress: customer.address
      }),
    });

    if (res.ok) {
      const result = await res.json();
      setLastSale(result);
      setCart([]);
      setCustomer({ name: "", phone: "", address: "" });
      fetchProducts();
      fetchStats();
      fetchSalesHistory();
      alert(`${type} Generado con éxito`);
    } else {
      const err = await res.json();
      alert(`Error: ${err.error}`);
    }
  };

  const shareWhatsApp = () => {
    if (!lastSale) return;

    const itemsList = lastSale.items.map((item: any) => {
      const product = products.find(p => p.id === item.productId);
      return `- ${product?.name || 'Producto'}: ${item.quantity} x $${item.price.toFixed(2)} = $${item.subtotal.toFixed(2)}`;
    }).join('\n');

    const message = `*FIT12 - ${lastSale.type}*\n\nHola ${lastSale.customerName || 'Cliente'},\n\nDetalle de tu compra:\n${itemsList}\n\n*TOTAL: $${lastSale.total.toFixed(2)}*\n\n_Para recibir el comprobante formal, por favor solicita que te adjunten el PDF descargado._`;

    const url = `https://wa.me/${lastSale.customerPhone?.replace(/\D/g, '') || ''}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };


  const printDocument = () => {
    window.print();
  };

  return (
    <main className="container">
      {/* BRANDING HEADER */}
      <header className="main-header glass no-print" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.2rem', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <img src="/logo.jpg" alt="FIT12 Logo" style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.1)' }} />
            <div>
              <h1 style={{ fontSize: '1.5rem', margin: 0, fontWeight: 800, letterSpacing: '-0.5px' }}>FIT12</h1>
              <p style={{ fontSize: '0.75rem', margin: 0, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '1px' }}>Dietética & Salud</p>
            </div>
          </div>
          <div className="hide-mobile" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Vendedor: <strong>Admin</strong>
          </div>
        </div>
      </header>

      <nav className="glass no-print" style={{
        display: 'flex', gap: '0.5rem', padding: '0.5rem',
        borderRadius: 'var(--radius-lg)', marginBottom: '1.5rem',
        overflowX: 'auto'
      }}>
        <button onClick={() => setActiveTab("dashboard")} className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`} style={{ flex: 1, justifyContent: 'center' }}>
          <BarChart3 size={20} /> <span className="hide-mobile">Dashboard</span>
        </button>
        <button onClick={() => setActiveTab("billing")} className={`nav-btn ${activeTab === 'billing' ? 'active' : ''}`} style={{ flex: 1, justifyContent: 'center' }}>
          <ShoppingCart size={20} /> <span className="hide-mobile">Vender</span>
        </button>
        <button onClick={() => setActiveTab("stock")} className={`nav-btn ${activeTab === 'stock' ? 'active' : ''}`} style={{ flex: 1, justifyContent: 'center' }}>
          <Package size={20} /> <span className="hide-mobile">Stock</span>
        </button>
      </nav>

      <section className="no-print">
        {activeTab === "stock" && (
          <div className="glass card animate-in">
            <header style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Gestión de Inventario</h2>
                <button className="primary-btn" onClick={() => setShowAddProduct(true)}>
                  <Plus size={20} /> Nuevo Producto
                </button>
              </div>
              <div className="input-with-icon" style={{ position: 'relative' }}>
                <Search className="search-icon" size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input
                  type="text"
                  placeholder="Buscar en inventario (nombre o código)..."
                  style={{ paddingLeft: '3rem' }}
                  value={inventorySearchTerm}
                  onChange={(e) => setInventorySearchTerm(e.target.value)}
                />
              </div>
            </header>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Stock</th>
                    <th>Venta</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {products
                    .filter((p: any) =>
                      p.name.toLowerCase().includes(inventorySearchTerm.toLowerCase()) ||
                      (p.code && p.code.toLowerCase().includes(inventorySearchTerm.toLowerCase()))
                    )
                    .map((p: any) => (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td>{p.category?.name}</td>
                        <td>
                          <span style={{
                            color: p.stock <= 0 ? '#ef4444' : p.stock < 500 ? '#f59e0b' : 'var(--secondary-color)',
                            fontWeight: 'bold'
                          }}>
                            {getAvailableStock(p).toFixed(p.unitType === 'kg' ? 2 : 0)} {p.unitType === 'kg' ? 'kg' : 'u'}
                          </span>
                        </td>
                        <td>${p.sellPrice} / {p.unitType}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              className="icon-btn"
                              onClick={() => handleOpenEdit(p)}
                              title="Editar producto"
                              style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', padding: '0.5rem', borderRadius: '0.5rem' }}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              className="icon-btn"
                              onClick={() => handleDeleteProduct(p)}
                              title="Eliminar producto"
                              style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.5rem', borderRadius: '0.5rem' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "billing" && (
          <div className="billing-grid animate-in">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Customer Data Card */}
              <div className="glass card">
                <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <UserIcon size={20} /> Datos del Cliente
                </h3>
                <div className="grid grid-3" style={{ gap: '1rem' }}>
                  <div className="input-group">
                    <label>Nombre / Razón Social</label>
                    <input type="text" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
                  </div>
                  <div className="input-group">
                    <label>Teléfono (WhatsApp)</label>
                    <input type="text" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
                  </div>
                  <div className="input-group">
                    <label>Dirección</label>
                    <input type="text" value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Sales Cart Card */}
              <div className="glass card">
                <header style={{ marginBottom: '1.5rem' }}>
                  <h2>Mostrador de Ventas</h2>
                  <div className="input-with-icon" style={{ marginTop: '1rem', position: 'relative' }}>
                    <Search className="search-icon" size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <input
                      type="text"
                      placeholder="Buscar producto por nombre o código..."
                      style={{ paddingLeft: '3rem' }}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchResults.length > 0 && (
                      <div className="search-results glass-deep" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, marginTop: '0.5rem', maxHeight: '300px', overflowY: 'auto', borderRadius: 'var(--radius-md)', background: 'rgba(30, 30, 35, 0.95)', backdropFilter: 'blur(20px)', border: '1px solid var(--border-color)' }}>
                        {searchResults.map(p => (
                          <div key={p.id} className="search-item" onClick={() => addToCart(p)} style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', opacity: getAvailableStock(p) <= 0 ? 0.5 : 1 }}>
                            <div>
                              <strong>{p.name}</strong><br />
                              <small>{p.code} - ${p.sellPrice}/{p.unitType}</small><br />
                              <small style={{ color: getAvailableStock(p) <= 0 ? '#ef4444' : '#10b981' }}>
                                Stock: {getAvailableStock(p).toFixed(p.unitType === 'kg' ? 3 : 0)} {p.unitType === 'kg' ? 'kg' : 'u'}
                                {getAvailableStock(p) <= 0 && ' ⚠️ Sin stock'}
                              </small>
                            </div>
                            <Plus size={16} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </header>

                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Cantidad</th>
                        <th>Subtotal</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map(item => (
                        <tr key={item.productId}>
                          <td>{item.name}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <input
                                type="number"
                                step={item.unitType === 'kg' ? '0.05' : '1'}
                                value={item.quantity}
                                onChange={(e) => updateCartQuantity(item.productId, e.target.value)}
                                style={{ width: '60px', padding: '0.4rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white' }}
                              />
                              <small style={{ fontSize: '0.75rem', opacity: 0.7 }}>{item.unitType}</small>
                            </div>
                          </td>
                          <td style={{ fontWeight: 'bold' }}>${item.subtotal.toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button onClick={() => removeFromCart(item.productId)} style={{ color: '#ef4444', background: 'transparent', border: 'none', padding: '0.4rem', cursor: 'pointer' }}>
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="glass card" style={{ height: 'fit-content' }}>
                <h3 style={{ marginBottom: '1.5rem' }}>Resumen de Venta</h3>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span>Subtotal</span>
                    <strong>${subtotal.toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <span>Impuestos (0%)</span>
                    <strong>$0.00</strong>
                  </div>
                  <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '1rem 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.5rem', fontWeight: 'bold' }}>
                    <span>TOTAL</span>
                    <span style={{ color: 'var(--secondary-color)' }}>${subtotal.toFixed(2)}</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '2rem' }}>
                  <button className="secondary-btn" onClick={() => processSale("Remito")}>Remito</button>
                  <button className="primary-btn" onClick={() => processSale("Factura")}>Facturar</button>
                </div>
              </div>

              {lastSale && (
                <div className="glass card animate-in" style={{ borderColor: 'var(--secondary-color)', background: 'rgba(16, 185, 129, 0.05)' }}>
                  <h3 style={{ marginBottom: '1rem', color: 'var(--secondary-color)' }}>¡Venta Exitosa!</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <button className="primary-btn" onClick={printDocument} style={{ width: '100%', justifyContent: 'center' }}>
                      <Download size={18} /> Descargar PDF (Imprimir)
                    </button>
                    <button className="secondary-btn" onClick={shareWhatsApp} style={{ width: '100%', justifyContent: 'center', borderColor: '#25D366', color: '#25D366', background: 'rgba(37, 211, 102, 0.1)' }}>
                      <Share2 size={18} /> Enviar por WhatsApp
                    </button>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '-0.5rem' }}>
                      Tip: Descarga el PDF y adjúntalo manualmente en WhatsApp.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "dashboard" && (
          <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Header with Date Filter */}
            <div className="glass card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.2rem 2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <BarChart3 size={24} style={{ color: 'var(--primary-color)' }} />
                <h2 style={{ margin: 0 }}>Panel de Control</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', width: '100%', justifyContent: 'flex-end' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 auto', minWidth: '150px' }}>
                  <label style={{ whiteSpace: 'nowrap', fontSize: '0.9rem' }}>Desde:</label>
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                    style={{ padding: '0.4rem 0.8rem', width: '100%' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 auto', minWidth: '150px' }}>
                  <label style={{ whiteSpace: 'nowrap', fontSize: '0.9rem' }}>Hasta:</label>
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                    style={{ padding: '0.4rem 0.8rem', width: '100%' }}
                  />
                </div>
                <button
                  className="secondary-btn"
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setDateRange({ startDate: today, endDate: today });
                  }}
                  style={{ padding: '0.4rem 1.2rem', height: '44px' }}
                >
                  Hoy
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.2rem' }}>
              <div className="glass card stats-card">
                <div className="stats-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary-color)' }}><ShoppingCart size={24} /></div>
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Ventas Totales</p>
                  <h3>{stats?.salesCount || 0}</h3>
                </div>
              </div>
              <div className="glass card stats-card">
                <div className="stats-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--secondary-color)' }}><BarChart3 size={24} /></div>
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Ingresos Brutos</p>
                  <h3 style={{ color: 'var(--secondary-color)' }}>${stats?.revenue?.toFixed(2) || '0.00'}</h3>
                </div>
              </div>
              <div className="glass card stats-card">
                <div className="stats-icon" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}><Save size={24} /></div>
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Ganancia Est.</p>
                  <h3 style={{ color: '#8b5cf6' }}>${stats?.profit?.toFixed(2) || '0.00'}</h3>
                </div>
              </div>

            </div>

            <div className="dashboard-widgets-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
              {/* Sales Chart */}
              <div className="glass card">
                <h3 style={{ marginBottom: '1.5rem' }}>Ventas de la Semana</h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '200px', padding: '0 1rem' }}>
                  {stats?.dailyData?.map((d: any, i: number) => {
                    const max = Math.max(...stats.dailyData.map((day: any) => day.total), 1);
                    const height = (d.total / max) * 100;
                    return (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                        <div style={{
                          width: '70%',
                          height: `${height}%`,
                          background: 'linear-gradient(to top, var(--primary-color), var(--secondary-color))',
                          borderRadius: '4px 4px 0 0',
                          minHeight: d.total > 0 ? '4px' : '2px',
                          opacity: d.total > 0 ? 1 : 0.2,
                          transition: 'height 0.5s ease'
                        }}></div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{d.day}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top Products & Low Stock */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
                {/* Top Products */}
                <div className="glass card">
                  <h3 style={{ marginBottom: '1.5rem' }}>Top 5 Productos</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {stats?.topProducts?.map((p: any, i: number) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
                        <div>
                          <strong style={{ display: 'block' }}>{p.name}</strong>
                          <small style={{ color: 'var(--text-secondary)' }}>{p.quantity} vendidos</small>
                        </div>
                        <span style={{ fontWeight: 'bold', color: 'var(--secondary-color)' }}>${p.revenue.toFixed(2)}</span>
                      </div>
                    ))}
                    {(!stats?.topProducts || stats.topProducts.length === 0) && (
                      <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>No hay datos suficientes</p>
                    )}
                  </div>
                </div>

                {/* Low Stock Alert */}
                <div className="glass card">
                  <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: '#f59e0b' }}>⚠️</span> Productos con Bajo Stock
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    {stats?.lowStockItems?.length > 0 ? stats.lowStockItems.map((item: any) => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem 1rem', borderRadius: 'var(--radius-md)', background: item.stock <= 0 ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.07)', border: `1px solid ${item.stock <= 0 ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}` }}>
                        <div>
                          <strong style={{ display: 'block', fontSize: '0.95rem' }}>{item.name}</strong>
                          <small style={{ color: 'var(--text-secondary)' }}>{item.category?.name}</small>
                        </div>
                        <span style={{ fontWeight: 'bold', color: item.stock <= 0 ? '#ef4444' : '#f59e0b', fontSize: '0.9rem' }}>
                          {(item.stock / (item.baseUnit === 'g' ? 1000 : 1)).toFixed(item.unitType === 'kg' ? 2 : 0)} {item.unitType === 'kg' ? 'kg' : 'u'}
                          {item.stock <= 0 && ' — Sin stock'}
                        </span>
                      </div>
                    )) : (
                      <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1.5rem' }}>✅ Todos los productos tienen stock suficiente</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Sales History */}
              <div className="glass card">
                <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Trash2 size={18} style={{ color: '#ef4444' }} /> Historial de Ventas
                  <small style={{ color: 'var(--text-secondary)', fontWeight: 'normal', marginLeft: 'auto' }}>Podés eliminar facturas erróneas — el stock se restaura automáticamente</small>
                </h3>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th>Cliente</th>
                        <th>Total</th>
                        <th>Eliminar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesHistory.length === 0 && (
                        <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No hay ventas en este período</td></tr>
                      )}
                      {salesHistory.map((sale: any) => (
                        <tr key={sale.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>{new Date(sale.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                          <td><span style={{ background: sale.type === 'Factura' ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.1)', color: sale.type === 'Factura' ? '#60a5fa' : '#10b981', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>{sale.type}</span></td>
                          <td style={{ color: 'var(--text-secondary)' }}>{sale.customerName || 'Consumidor Final'}</td>
                          <td style={{ fontWeight: 'bold', color: 'var(--secondary-color)' }}>${sale.total.toFixed(2)}</td>
                          <td>
                            <button
                              onClick={() => deleteSale(sale.id)}
                              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '0.35rem 0.7rem', borderRadius: '0.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
                              title="Eliminar esta venta y restaurar stock"
                            >
                              <Trash2 size={13} /> Anular
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        )}
      </section>

      {/* PRINTABLE AREA (HIDDEN ON SCREEN) */}
      <div className="print-only">
        {lastSale && (
          <div style={{ padding: '2rem', color: 'black', background: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid black', paddingBottom: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <img src="/logo.jpg" alt="FIT12 Logo" style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover' }} />
                <div>
                  <h1 style={{ fontSize: '2.8rem', color: '#000', margin: 0, fontWeight: 900, lineHeight: 1 }}>FIT12</h1>
                  <p style={{ marginTop: '0.2rem', fontSize: '1.1rem', fontWeight: 'bold', color: '#444' }}>PRODUCTOS SALUDABLES</p>
                  <p style={{ marginTop: '0.1rem', fontSize: '1rem' }}>Cordoba Argentina</p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h2 style={{ fontSize: '1.8rem', margin: 0 }}>{lastSale.type.toUpperCase()}</h2>
                <p style={{ margin: '0.5rem 0 0.2rem' }}>Fecha: {new Date(lastSale.createdAt).toLocaleDateString()}</p>
                <p style={{ margin: 0 }}>Nro: {lastSale.id.slice(-6).toUpperCase()}</p>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ textTransform: 'uppercase', marginBottom: '0.5rem' }}>Cliente:</h4>
              <p><strong>{lastSale.customerName || 'Consumidor Final'}</strong></p>
              <p>Tel: {lastSale.customerPhone || '-'}</p>
              <p>Dir: {lastSale.customerAddress || '-'}</p>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem', borderBottom: '1px solid black' }}>Descripción</th>
                  <th style={{ padding: '0.5rem', borderBottom: '1px solid black' }}>Cant.</th>
                  <th style={{ padding: '0.5rem', borderBottom: '1px solid black' }}>P.Unit</th>
                  <th style={{ padding: '0.5rem', borderBottom: '1px solid black' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {lastSale.items.map((item: any, idx: number) => {
                  const product = products.find(p => p.id === item.productId);
                  return (
                    <tr key={idx}>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{product?.name || 'Producto'}</td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{item.quantity}</td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>${item.price.toFixed(2)}</td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>${item.subtotal.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div style={{ textAlign: 'right', fontSize: '1.2rem' }}>
              <p>TOTAL: <strong>${lastSale.total.toFixed(2)}</strong></p>
            </div>

            <div style={{ marginTop: '4rem', textAlign: 'center', borderTop: '1px dashed #ccc', paddingTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E1306C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
              </svg>
              <span style={{ color: '#E1306C', fontWeight: '600', fontSize: '0.95rem' }}>@Fit12cba</span>
            </div>
          </div>
        )}
      </div>

      {showAddProduct && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass modal-content card animate-in" style={{ width: '90%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem' }}>{editingProduct ? 'Editar Producto' : 'Registrar Producto'}</h2>
              <button onClick={() => { setShowAddProduct(false); setEditingProduct(null); setNewProduct(resetNewProduct()); }} style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
            </header>

            <form onSubmit={handleCreateProduct} className="product-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.2rem' }}>
              <div className="input-group">
                <label>Nombre</label>
                <input type="text" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="Ej: Nueces Mariposa" required />
              </div>
              <div className="input-group">
                <label>Categoría</label>
                <select className="custom-select" value={newProduct.categoryId} onChange={(e) => setNewProduct({ ...newProduct, categoryId: e.target.value })} required style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.8rem 1rem', color: 'var(--text-primary)' }}>
                  <option value="" style={{ color: 'black' }}>Seleccionar...</option>
                  <option value="new" style={{ color: 'black', fontWeight: 'bold' }}>+ Nueva Categoría...</option>
                  {categories.map((c: any) => (<option key={c.id} value={c.id} style={{ color: 'black' }}>{c.name}</option>))}
                </select>
              </div>

              {newProduct.categoryId === "new" && (
                <div className="input-group animate-in">
                  <label>Nombre de la Nueva Categoría</label>
                  <input
                    type="text"
                    value={newProduct.newCategoryName}
                    onChange={(e) => setNewProduct({ ...newProduct, newCategoryName: e.target.value })}
                    placeholder="Ej: Semillas"
                    required
                  />
                </div>
              )}
              <div className="input-group">
                <label>Tipo de Venta</label>
                <select className="custom-select" value={newProduct.unitType} onChange={(e) => setNewProduct({ ...newProduct, unitType: e.target.value })} style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.8rem 1rem', color: 'var(--text-primary)' }}>
                  <option value="kg" style={{ color: 'black' }}>Por kilogramo</option>
                  <option value="unit" style={{ color: 'black' }}>Por unidad</option>
                </select>
              </div>
              <div className="input-group">
                <label>Precio Venta</label>
                <input type="number" step="0.01" value={newProduct.sellPrice} onChange={(e) => setNewProduct({ ...newProduct, sellPrice: e.target.value })} required />
              </div>
              <div className="input-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Stock Actual
                  <span title="Cantidad disponible en la unidad de venta (kg o unidades)" style={{ cursor: 'help', fontSize: '1rem', background: 'rgba(255,255,255,0.1)', width: '18px', height: '18px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>?</span>
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={newProduct.stock}
                  onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="input-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Unidad Base
                  <span title="Unidad mínima en la que mides el stock (Ej: 'g' para granos, 'u' para cajas)" style={{ cursor: 'help', fontSize: '1rem', background: 'rgba(255,255,255,0.1)', width: '18px', height: '18px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>?</span>
                </label>
                <select
                  className="custom-select"
                  value={newProduct.baseUnit}
                  onChange={(e) => setNewProduct({ ...newProduct, baseUnit: e.target.value })}
                  style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.8rem 1rem', color: 'var(--text-primary)' }}
                >
                  <option value="g" style={{ color: 'black' }}>Gramos (g)</option>
                  <option value="u" style={{ color: 'black' }}>Unidad (u)</option>
                  <option value="kg" style={{ color: 'black' }}>Kilogramos (kg)</option>
                </select>
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" className="primary-btn" style={{ flex: 1 }}>
                  <Save size={20} /> {editingProduct ? 'Guardar Cambios' : 'Guardar Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .billing-grid { grid-template-columns: 1fr; }
        .product-form-grid { grid-template-columns: 1fr; }
        @media (min-width: 1024px) {
          .billing-grid { grid-template-columns: 1.2fr 0.8fr !important; }
          .product-form-grid { grid-template-columns: 1fr 1fr !important; }
          .dashboard-widgets-grid { grid-template-columns: 1.5fr 1fr !important; }
        }
        @media (max-width: 768px) {
          .main-header { padding: 1rem !important; margin-bottom: 1rem !important; }
          .nav-btn { font-size: 0.8rem; padding: 0.6rem !important; }
          .grid { gap: 1rem !important; }
          .glass.card { padding: 1.2rem !important; }
          h2 { fontSize: 1.25rem !important; }
          .table-container { 
            width: 100%;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          table {
            min-width: 600px;
          }
        }
        .low-stock-card:hover .low-stock-dropdown {
          opacity: 1 !important;
          visibility: visible !important;
          pointer-events: auto !important;
          transform: translateY(5px);
        }
        .nav-btn { display: flex; align-items: center; gap: 0.5rem; padding: 0.8rem 1.2rem; border-radius: var(--radius-md); background: transparent; color: var(--text-secondary); font-weight: 600; }
        .nav-btn.active { background: var(--primary-color); color: white; }
        .nav-btn:hover:not(.active) { background: rgba(255, 255, 255, 0.05); }
        .primary-btn { background: var(--primary-color); color: white; padding: 0.8rem 1.5rem; border-radius: var(--radius-md); display: flex; align-items: center; gap: 0.5rem; font-weight: 600; }
        .secondary-btn { background: rgba(16, 185, 129, 0.1); color: var(--secondary-color); border: 1px solid var(--secondary-color); padding: 0.8rem 1.5rem; border-radius: var(--radius-md); display: flex; align-items: center; gap: 0.5rem; font-weight: 600; }
        .table-container { overflow-x: auto; margin-top: 1rem; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 1rem; color: var(--text-secondary); border-bottom: 2px solid var(--border-color); font-size: 0.85rem; text-transform: uppercase; }
        td { padding: 1rem; border-bottom: 1px solid var(--border-color); }
        .stats-card { display: flex; align-items: center; gap: 1.2rem; }
        .stats-icon { padding: 1rem; border-radius: 1rem; display: flex; align-items: center; justify-content: center; }
        .stats-card h3 { font-size: 1.8rem; margin: 0; }
        .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); }
        .animate-in { animation: slideUp 0.3s ease-out; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        .print-only { display: none; }
        @media print {
          @page { margin: 0.5cm; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; margin: 0; padding: 0; }
          .container { max-width: 100% !important; padding: 0 !important; width: 100% !important; margin: 0 !important; }
        }
      `}</style>
    </main>
  );
}
