import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Camera, History, Languages, Package, PlusCircle, Search, ShoppingBag, Upload } from 'lucide-react';
import { createWorker } from 'tesseract.js';
import './styles.css';

const copy = {
  en: {
    title: 'StockMaster', subtitle: 'Simple live stock for handicrafts', purchase: 'Buy / Add Stock', sale: 'Sale / Send to Shop', stock: 'Live Stock', history: 'History',
    supplier: 'Manufacturer name', shop: 'Shop name', bill: 'Bill no. (optional)', notes: 'Notes', sku: 'SKU', item: 'Item name', material: 'Material', qty: 'Qty', price: 'Price', addLine: 'Add item', saveBuy: 'Buy & Add', saveSale: 'Sale & Subtract', upload: 'Upload or capture bill', scan: 'Scan bill image', search: 'Search SKU, name, material', low: 'Low stock', total: 'Total units', skus: 'SKUs', active: 'Active', empty: 'No records yet', parsed: 'Review extracted items before saving', remove: 'Remove', success: 'Saved successfully', manual: 'Manual entry is always available below.'
  },
  hi: {
    title: 'स्टॉकमास्टर', subtitle: 'हैंडीक्राफ्ट के लिए आसान लाइव स्टॉक', purchase: 'खरीद / स्टॉक जोड़ें', sale: 'बिक्री / दुकान भेजें', stock: 'लाइव स्टॉक', history: 'हिस्ट्री',
    supplier: 'मैन्युफैक्चरर नाम', shop: 'दुकान का नाम', bill: 'बिल नंबर (वैकल्पिक)', notes: 'नोट्स', sku: 'SKU', item: 'आइटम नाम', material: 'मटेरियल', qty: 'मात्रा', price: 'कीमत', addLine: 'आइटम जोड़ें', saveBuy: 'खरीद जोड़ें', saveSale: 'बिक्री घटाएं', upload: 'बिल अपलोड या फोटो लें', scan: 'बिल स्कैन करें', search: 'SKU, नाम, मटेरियल खोजें', low: 'कम स्टॉक', total: 'कुल पीस', skus: 'SKUs', active: 'एक्टिव', empty: 'अभी कोई रिकॉर्ड नहीं', parsed: 'सेव करने से पहले निकले आइटम जांचें', remove: 'हटाएं', success: 'सफलतापूर्वक सेव हुआ', manual: 'नीचे मैन्युअल एंट्री भी कर सकते हैं।'
  }
};

const blankLine = { sku: '', name: '', material: 'Wooden', quantity: 1, unit_price: '' };

async function api(path, options = {}) {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function Stat({ label, value }) {
  return <div className="stat"><strong>{value}</strong><span>{label}</span></div>;
}

function TransactionForm({ mode, lang, onSaved, stock }) {
  const t = copy[lang];
  const [partyName, setPartyName] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ ...blankLine }]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const isSale = mode === 'sale';
  const endpoint = isSale ? '/api/sales' : '/api/purchases';

  function updateLine(index, key, value) {
    setItems((rows) => rows.map((row, i) => i === index ? { ...row, [key]: value } : row));
  }

  function removeLine(index) {
    setItems((rows) => rows.length === 1 ? rows : rows.filter((_, i) => i !== index));
  }

  async function scanBill(file) {
    if (!file) return;
    setBusy(true);
    setMessage('Reading image... / इमेज पढ़ रहे हैं...');
    try {
      const worker = await createWorker('eng+hin');
      const result = await worker.recognize(file);
      await worker.terminate();
      const parsed = await api('/api/parse-bill', { method: 'POST', body: JSON.stringify({ text: result.data.text }) });
      if (parsed.items.length) {
        setItems(parsed.items.map((item) => ({ ...blankLine, ...item, material: item.material || 'Wooden' })));
        setMessage(t.parsed);
      } else {
        setMessage('No item lines found. Try clearer photo or enter manually. / साफ फोटो लें या मैन्युअल भरें।');
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const payload = {
        [isSale ? 'shopName' : 'manufacturerName']: partyName,
        billNumber,
        notes,
        items: items.map((item) => ({ ...item, quantity: Number(item.quantity), unit_price: item.unit_price === '' ? null : Number(item.unit_price) }))
      };
      await api(endpoint, { method: 'POST', body: JSON.stringify(payload) });
      setMessage(t.success);
      setPartyName(''); setBillNumber(''); setNotes(''); setItems([{ ...blankLine }]);
      onSaved();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return <form className="card form" onSubmit={submit}>
    <h2>{isSale ? t.sale : t.purchase}</h2>
    <label>{isSale ? t.shop : t.supplier}<input value={partyName} onChange={(e) => setPartyName(e.target.value)} placeholder={isSale ? 'Sharma Handicrafts' : 'Jaipur Artisan Co.'} /></label>
    <div className="grid2"><label>{t.bill}<input value={billNumber} onChange={(e) => setBillNumber(e.target.value)} /></label><label>{t.notes}<input value={notes} onChange={(e) => setNotes(e.target.value)} /></label></div>
    <div className="uploader"><Upload size={18}/><span>{t.upload}</span><input type="file" accept="image/*" capture="environment" onChange={(e) => scanBill(e.target.files?.[0])} disabled={busy}/></div>
    <p className="hint"><Camera size={16}/> {t.manual}</p>
    {items.map((line, index) => {
      const available = stock.find((item) => item.sku === String(line.sku).toUpperCase())?.current_stock;
      return <div className="line" key={index}>
        <div className="grid2"><label>{t.sku}<input required value={line.sku} onChange={(e) => updateLine(index, 'sku', e.target.value)} list="sku-list" /></label><label>{t.item}<input required value={line.name} onChange={(e) => updateLine(index, 'name', e.target.value)} /></label></div>
        <div className="grid3"><label>{t.material}<select value={line.material} onChange={(e) => updateLine(index, 'material', e.target.value)}><option>Wooden</option><option>Metal</option><option>Fabric</option><option>Stone</option><option>Other</option></select></label><label>{t.qty}<input required type="number" min="1" value={line.quantity} onChange={(e) => updateLine(index, 'quantity', e.target.value)} /></label><label>{t.price}<input type="number" min="0" step="0.01" value={line.unit_price ?? ''} onChange={(e) => updateLine(index, 'unit_price', e.target.value)} /></label></div>
        {isSale && available !== undefined && <small>Available / उपलब्ध: {available}</small>}
        <button type="button" className="ghost" onClick={() => removeLine(index)}>{t.remove}</button>
      </div>;
    })}
    <datalist id="sku-list">{stock.map((item) => <option key={item.id} value={item.sku}>{item.name}</option>)}</datalist>
    <button type="button" className="secondary" onClick={() => setItems((rows) => [...rows, { ...blankLine }])}><PlusCircle size={18}/> {t.addLine}</button>
    <button disabled={busy} className="primary">{busy ? 'Saving...' : (isSale ? t.saveSale : t.saveBuy)}</button>
    {message && <div className={message === t.success ? 'success' : 'notice'}>{message}</div>}
  </form>;
}

function App() {
  const [lang, setLang] = useState('en');
  const [tab, setTab] = useState('purchase');
  const [stock, setStock] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const t = copy[lang];

  async function refresh() {
    try {
      setError('');
      const [items, dash, tx] = await Promise.all([api('/api/items'), api('/api/dashboard'), api('/api/transactions')]);
      setStock(items); setDashboard(dash); setHistory(tx);
    } catch (err) { setError(err.message); }
  }

  useEffect(() => { refresh(); }, []);
  const filtered = useMemo(() => stock.filter((item) => `${item.sku} ${item.name} ${item.material}`.toLowerCase().includes(search.toLowerCase())), [stock, search]);

  return <main>
    <header className="hero"><div><h1>{t.title}</h1><p>{t.subtitle}</p></div><button className="lang" onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}><Languages size={18}/> {lang === 'en' ? 'हिंदी' : 'English'}</button></header>
    {dashboard && <section className="stats"><Stat label={t.skus} value={dashboard.totalSkus}/><Stat label={t.active} value={dashboard.activeSkus}/><Stat label={t.total} value={dashboard.totalUnits}/><Stat label={t.low} value={dashboard.lowStock}/></section>}
    {error && <div className="error">{error}</div>}
    <nav className="tabs"><button onClick={() => setTab('purchase')} className={tab === 'purchase' ? 'active' : ''}><PlusCircle/> {t.purchase}</button><button onClick={() => setTab('sale')} className={tab === 'sale' ? 'active' : ''}><ShoppingBag/> {t.sale}</button><button onClick={() => setTab('stock')} className={tab === 'stock' ? 'active' : ''}><Package/> {t.stock}</button><button onClick={() => setTab('history')} className={tab === 'history' ? 'active' : ''}><History/> {t.history}</button></nav>
    {tab === 'purchase' && <TransactionForm mode="purchase" lang={lang} onSaved={refresh} stock={stock}/>} 
    {tab === 'sale' && <TransactionForm mode="sale" lang={lang} onSaved={refresh} stock={stock}/>} 
    {tab === 'stock' && <section className="card"><h2>{t.stock}</h2><label className="search"><Search size={18}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.search}/></label><div className="stockList">{filtered.map((item) => <article className={item.current_stock <= item.reorder_level ? 'stockItem low' : 'stockItem'} key={item.id}><strong>{item.sku}</strong><div><b>{item.name}</b><span>{item.material} • {item.category}</span></div><em>{item.current_stock}</em></article>)}</div></section>}
    {tab === 'history' && <section className="card"><h2>{t.history}</h2>{history.length === 0 && <p>{t.empty}</p>}{history.map((tx) => <article className="tx" key={tx.id}><div><strong>{tx.type === 'purchase' ? t.purchase : t.sale}</strong><span>{new Date(tx.created_at).toLocaleString()} • {tx.party_name || '-'}</span></div><ul>{tx.stock_transaction_lines?.map((line) => <li key={line.id}>{line.sku} — {line.quantity} ({line.stock_before} → {line.stock_after})</li>)}</ul></article>)}</section>}
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
