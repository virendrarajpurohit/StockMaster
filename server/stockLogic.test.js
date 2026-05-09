import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStockAfter, normalizeSku, parseBillText, validateTransactionLine } from './stockLogic.js';

test('normalizes SKU and validates transaction line', () => {
  const line = validateTransactionLine({ sku: ' wh-001 ', name: 'Wooden Horse', quantity: '3', price: '25.5' }, 0);
  assert.equal(line.sku, 'WH-001');
  assert.equal(line.quantity, 3);
  assert.equal(line.unit_price, 25.5);
  assert.equal(normalizeSku(' ab '), 'AB');
});

test('prevents negative stock on sale', () => {
  assert.equal(calculateStockAfter('sale', 10, 4), 6);
  assert.throws(() => calculateStockAfter('sale', 1, 2), /Insufficient stock/);
});

test('parses simple OCR bill lines', () => {
  const parsed = parseBillText('WH-001 Wooden Elephant 12 @ 80\nBAD LINE\nMT-2 Metal Diya 5 45');
  assert.deepEqual(parsed, [
    { sku: 'WH-001', name: 'Wooden Elephant', quantity: 12, unit_price: 80 },
    { sku: 'MT-2', name: 'Metal Diya', quantity: 5, unit_price: 45 }
  ]);
});
