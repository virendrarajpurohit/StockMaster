export function normalizeSku(sku) {
  return String(sku || '').trim().toUpperCase();
}

export function toPositiveInt(value, field = 'quantity') {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw Object.assign(new Error(`${field} must be a positive whole number`), { status: 400 });
  }
  return parsed;
}

export function toOptionalMoney(value, field = 'price') {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw Object.assign(new Error(`${field} must be zero or more`), { status: 400 });
  }
  return Math.round(parsed * 100) / 100;
}

export function validateTransactionLine(line, index) {
  const sku = normalizeSku(line.sku);
  const name = String(line.name || line.item_name || '').trim();
  if (!sku) throw Object.assign(new Error(`Line ${index + 1}: SKU is required`), { status: 400 });
  if (!name) throw Object.assign(new Error(`Line ${index + 1}: item name is required`), { status: 400 });
  return {
    sku,
    name,
    category: String(line.category || 'General').trim() || 'General',
    material: String(line.material || 'Other').trim() || 'Other',
    unit: String(line.unit || 'pcs').trim() || 'pcs',
    quantity: toPositiveInt(line.quantity, `Line ${index + 1} quantity`),
    unit_price: toOptionalMoney(line.unit_price ?? line.price, `Line ${index + 1} price`),
    reorder_level: Number.isInteger(Number(line.reorder_level)) ? Math.max(0, Number(line.reorder_level)) : 5
  };
}

export function calculateStockAfter(type, currentStock, quantity) {
  if (type === 'purchase') return currentStock + quantity;
  if (type === 'sale') {
    if (currentStock < quantity) {
      throw Object.assign(new Error(`Insufficient stock. Available ${currentStock}, requested ${quantity}`), { status: 409 });
    }
    return currentStock - quantity;
  }
  throw Object.assign(new Error('Unsupported transaction type'), { status: 400 });
}

export function parseBillText(text) {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const items = [];
  for (const raw of lines) {
    const cleaned = raw.replace(/[|,]+/g, ' ').replace(/\s+/g, ' ');
    const match = cleaned.match(/^([A-Za-z0-9][A-Za-z0-9-_]{1,})\s+(.+?)\s+(\d+)\s*(?:pcs|piece|pieces|qty|नग)?\s*(?:@|x|rs\.?|₹)?\s*(\d+(?:\.\d{1,2})?)?$/i);
    if (match) {
      items.push({ sku: normalizeSku(match[1]), name: match[2].trim(), quantity: Number(match[3]), unit_price: match[4] ? Number(match[4]) : null });
    }
  }
  return items;
}
