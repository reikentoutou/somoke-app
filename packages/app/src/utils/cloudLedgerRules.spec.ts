import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

interface ProductLike {
  product_id?: string
  name?: string
  category_id?: string
  unit_price?: number | string
  current_stock?: number | string
  is_deleted?: number | boolean
}

interface CategoryLike {
  name?: string
}

interface RecordItemLike {
  product_name?: string
  category_id?: string
  category_name?: string
  unit_price?: number
}

interface StockIssue {
  productId: string
  productName?: string
  requested?: number
  available?: number
  delta?: number
}

interface StoreBalance {
  current_stock: number
  current_cash: number
}

interface LedgerRules {
  parseStockValue(value: unknown): number
  parseCashValue(value: unknown): number
  nextStoreBalance(
    currentStock: unknown,
    currentCash: unknown,
    stockDelta: unknown,
    cashDelta: unknown
  ): StoreBalance
  selectRecordItemSnapshot(
    product: ProductLike | null,
    category: CategoryLike | null,
    oldItem?: RecordItemLike | null
  ): RecordItemLike
  findInsufficientStockDeduct(
    stockByProduct: Record<string, number>,
    liveStocks: Record<string, number>,
    productNames?: Record<string, string>
  ): StockIssue | null
  findInsufficientStockDelta(
    stockDeltaByProduct: Record<string, number>,
    liveStocks: Record<string, number>,
    productNames?: Record<string, string>
  ): StockIssue | null
  findNonZeroStockProduct(products: ProductLike[]): ProductLike | null
}

const require = createRequire(import.meta.url)
const ledgerRules = require('../../../../cloudfunctions/api/ledgerRules.js') as LedgerRules
const apiIndexSource = readFileSync(
  new URL('../../../../cloudfunctions/api/index.js', import.meta.url),
  'utf8'
)

function functionBody(source: string, name: string): string {
  const start = source.indexOf(`async function ${name}`)
  const next = source.indexOf('\nasync function ', start + 1)
  return source.slice(start, next > start ? next : undefined)
}

describe('cloud ledger rules', () => {
  it('computes store balance deltas numerically when cloud values are stored as strings', () => {
    expect(ledgerRules.parseStockValue('10')).toBe(10)
    expect(ledgerRules.parseCashValue('1000.5')).toBe(1000.5)

    expect(ledgerRules.nextStoreBalance('10', '1000.5', 5, -300.25)).toEqual({
      current_stock: 15,
      current_cash: 700.25
    })
  })

  it('preserves historical item snapshot when editing an existing product row', () => {
    const snapshot = ledgerRules.selectRecordItemSnapshot(
      { product_id: 'p1', name: '新名称', category_id: 'new-cat', unit_price: 120 },
      { name: '新分类' },
      {
        product_name: '旧名称',
        category_id: 'old-cat',
        category_name: '旧分类',
        unit_price: 88
      }
    )

    expect(snapshot).toEqual({
      product_name: '旧名称',
      category_id: 'old-cat',
      category_name: '旧分类',
      unit_price: 88
    })
  })

  it('uses current catalog data for newly added product rows', () => {
    const snapshot = ledgerRules.selectRecordItemSnapshot(
      { product_id: 'p2', name: '新品', category_id: 'cat-2', unit_price: '35' },
      { name: '饮料' },
      null
    )

    expect(snapshot).toEqual({
      product_name: '新品',
      category_id: 'cat-2',
      category_name: '饮料',
      unit_price: 35
    })
  })

  it('detects add-record stock deductions that exceed live stock', () => {
    expect(
      ledgerRules.findInsufficientStockDeduct(
        { p1: 6, p2: 1 },
        { p1: 5, p2: 4 },
        { p1: '可乐', p2: '茶' }
      )
    ).toEqual({
      productId: 'p1',
      productName: '可乐',
      requested: 6,
      available: 5
    })

    expect(ledgerRules.findInsufficientStockDeduct({ p1: 5 }, { p1: 5 })).toBeNull()
  })

  it('detects update-record extra deductions that exceed live stock', () => {
    expect(
      ledgerRules.findInsufficientStockDelta(
        { p1: -3, p2: 2 },
        { p1: 2, p2: 0 },
        { p1: '可乐', p2: '茶' }
      )
    ).toEqual({
      productId: 'p1',
      productName: '可乐',
      delta: -3,
      available: 2
    })

    expect(ledgerRules.findInsufficientStockDelta({ p1: 2 }, { p1: 0 })).toBeNull()
    expect(ledgerRules.findInsufficientStockDelta({ p1: -2 }, { p1: 2 })).toBeNull()
  })

  it('finds active products with non-zero stock before delete', () => {
    expect(
      ledgerRules.findNonZeroStockProduct([
        { product_id: 'deleted', name: '已删', current_stock: 99, is_deleted: 1 },
        { product_id: 'zero', name: '零库存', current_stock: 0 },
        { product_id: 'active', name: '有库存', current_stock: '2' }
      ])
    ).toEqual({ product_id: 'active', name: '有库存', current_stock: '2' })

    expect(
      ledgerRules.findNonZeroStockProduct([{ product_id: 'zero', current_stock: 0 }])
    ).toBeNull()
  })

  it('keeps getRecords report reads paginated instead of capped at 500 rows', () => {
    const body = functionBody(apiIndexSource, 'handleGetRecords')

    expect(body).toContain("fetchAllByWhere('shift_records'")
    expect(body).not.toContain('.limit(500)')
  })
})
