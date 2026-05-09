import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSupabase } from './supabase.js';
import { parseBillText, validateTransactionLine } from './stockLogic.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 10000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

async function recordTransaction({ type, partyType, partyName, billNumber, notes, lines }) {
  const supabase = getSupabase();
  const cleanLines = lines.map(validateTransactionLine);
  if (!cleanLines.length) throw Object.assign(new Error('At least one item is required'), { status: 400 });

  const { data: transactionId, error: rpcError } = await supabase.rpc('record_stock_transaction', {
    p_type: type,
    p_party_type: partyType,
    p_party_name: partyName || null,
    p_bill_number: billNumber || null,
    p_notes: notes || null,
    p_lines: cleanLines
  });
  if (rpcError) {
    const status = /Insufficient stock/.test(rpcError.message) ? 409 : /does not exist/.test(rpcError.message) ? 404 : 400;
    throw Object.assign(new Error(rpcError.message), { status });
  }

  const { data, error } = await supabase
    .from('stock_transactions')
    .select('*, stock_transaction_lines(*)')
    .eq('id', transactionId)
    .single();
  if (error) throw error;
  return data;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'stockmaster', time: new Date().toISOString() });
});

app.get('/api/items', asyncHandler(async (req, res) => {
  const supabase = getSupabase();
  const search = String(req.query.search || '').trim();
  let query = supabase.from('items').select('*').order('name');
  if (search) query = query.or(`sku.ilike.%${search}%,name.ilike.%${search}%,material.ilike.%${search}%`);
  const { data, error } = await query;
  if (error) throw error;
  res.json(data);
}));

app.get('/api/dashboard', asyncHandler(async (_req, res) => {
  const supabase = getSupabase();
  const { data: items, error: itemError } = await supabase.from('items').select('current_stock,reorder_level,is_active');
  if (itemError) throw itemError;
  const { data: recent, error: recentError } = await supabase
    .from('stock_transactions')
    .select('*, stock_transaction_lines(*)')
    .order('created_at', { ascending: false })
    .limit(8);
  if (recentError) throw recentError;
  res.json({
    totalSkus: items.length,
    activeSkus: items.filter((item) => item.is_active).length,
    totalUnits: items.reduce((sum, item) => sum + item.current_stock, 0),
    lowStock: items.filter((item) => item.current_stock <= item.reorder_level).length,
    recent
  });
}));

app.get('/api/transactions', asyncHandler(async (_req, res) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('stock_transactions')
    .select('*, stock_transaction_lines(*)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  res.json(data);
}));

app.post('/api/purchases', asyncHandler(async (req, res) => {
  const result = await recordTransaction({
    type: 'purchase',
    partyType: 'manufacturer',
    partyName: req.body.manufacturerName,
    billNumber: req.body.billNumber,
    notes: req.body.notes,
    lines: req.body.items || []
  });
  res.status(201).json(result);
}));

app.post('/api/sales', asyncHandler(async (req, res) => {
  const result = await recordTransaction({
    type: 'sale',
    partyType: 'shop',
    partyName: req.body.shopName,
    billNumber: req.body.billNumber,
    notes: req.body.notes,
    lines: req.body.items || []
  });
  res.status(201).json(result);
}));

app.post('/api/parse-bill', (req, res) => {
  res.json({ items: parseBillText(req.body.text || '') });
});

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));

app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  console.error(err);
  res.status(status).json({ error: err.message || 'Unexpected server error' });
});

app.listen(port, () => {
  console.log(`StockMaster running on port ${port}`);
});
