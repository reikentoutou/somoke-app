'use strict';

function parseStockValue(value) {
  var n = parseInt(value, 10);
  return isNaN(n) ? 0 : n;
}

function parseCashValue(value) {
  var n = parseFloat(value);
  return isNaN(n) || !isFinite(n) ? 0 : n;
}

function nextStoreBalance(currentStock, currentCash, stockDelta, cashDelta) {
  var nextStock = parseStockValue(currentStock) + parseStockValue(stockDelta);
  if (nextStock < 0) nextStock = 0;
  return {
    current_stock: nextStock,
    current_cash: parseCashValue(currentCash) + parseCashValue(cashDelta)
  };
}

function selectRecordItemSnapshot(product, category, oldItem) {
  if (oldItem) {
    return {
      product_name: oldItem.product_name || '',
      category_id: oldItem.category_id || 0,
      category_name: oldItem.category_name || '',
      unit_price: parseFloat(oldItem.unit_price) || 0
    };
  }
  return {
    product_name: product ? product.name || '' : '',
    category_id: product ? product.category_id || 0 : 0,
    category_name: category ? category.name || '' : (product && product.category_name ? product.category_name : ''),
    unit_price: parseFloat(product && product.unit_price) || 0
  };
}

function findInsufficientStockDeduct(stockByProduct, liveStocks, productNames) {
  var productIds = Object.keys(stockByProduct || {});
  for (var i = 0; i < productIds.length; i++) {
    var productId = productIds[i];
    var requested = parseStockValue(stockByProduct[productId]);
    if (requested <= 0) continue;
    var available = parseStockValue(liveStocks && liveStocks[productId]);
    if (requested > available) {
      return {
        productId: productId,
        productName: productNames && productNames[productId] ? productNames[productId] : undefined,
        requested: requested,
        available: available
      };
    }
  }
  return null;
}

function findInsufficientStockDelta(stockDeltaByProduct, liveStocks, productNames) {
  var productIds = Object.keys(stockDeltaByProduct || {});
  for (var i = 0; i < productIds.length; i++) {
    var productId = productIds[i];
    var delta = parseStockValue(stockDeltaByProduct[productId]);
    if (delta >= 0) continue;
    var available = parseStockValue(liveStocks && liveStocks[productId]);
    if (available + delta < 0) {
      return {
        productId: productId,
        productName: productNames && productNames[productId] ? productNames[productId] : undefined,
        delta: delta,
        available: available
      };
    }
  }
  return null;
}

function isDeletedProduct(product) {
  return product && (product.is_deleted === 1 || product.is_deleted === true || product.is_deleted === '1');
}

function findNonZeroStockProduct(products) {
  for (var i = 0; i < (products || []).length; i++) {
    var product = products[i];
    if (!product || isDeletedProduct(product)) continue;
    if (parseStockValue(product.current_stock) !== 0) return product;
  }
  return null;
}

module.exports = {
  parseStockValue: parseStockValue,
  parseCashValue: parseCashValue,
  nextStoreBalance: nextStoreBalance,
  selectRecordItemSnapshot: selectRecordItemSnapshot,
  findInsufficientStockDeduct: findInsufficientStockDeduct,
  findInsufficientStockDelta: findInsufficientStockDelta,
  findNonZeroStockProduct: findNonZeroStockProduct
};
