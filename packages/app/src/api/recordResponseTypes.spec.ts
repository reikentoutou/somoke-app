import { describe, expect, it } from 'vitest'
import type { AddRecordRes, RecordItem, UpdateRecordRes } from '@somoke/shared'

const sampleItem: RecordItem = {
  product_id: 1,
  product_name: '商品A',
  category_id: 1,
  category_name: '分类A',
  unit_price: 100,
  qty_opening: 4,
  qty_closing: 2,
  qty_gift: 0,
  qty_sold: 2,
  sold_wechat: 1,
  sold_alipay: 1,
  sold_cash: 0,
  stock_deduct: 2,
  total_revenue: 200
}

describe('record response contracts', () => {
  it('accepts the flat addRecord response shape returned by the cloud function', () => {
    const response: AddRecordRes = {
      id: 1,
      store_id: 1,
      shift_config_id: 1,
      recorder: '店员',
      record_date: '2026-06-30',
      items: [sampleItem],
      qty_opening: 10,
      qty_closing: 8,
      qty_gift: 0,
      qty_sold: 2,
      sold_wechat: 1,
      sold_alipay: 1,
      sold_cash: 0,
      cash_opening: 1000,
      cash_closing: 1200,
      unit_price: 100,
      total_revenue: 200,
      stock_deduct: 2,
      current_stock: 8,
      current_cash: 1200
    }

    expect(response.items[0]?.product_name).toBe('商品A')
  })

  it('accepts the flat updateRecord response shape returned by the cloud function', () => {
    const response: UpdateRecordRes = {
      id: 1,
      record_date: '2026-06-30',
      items: [sampleItem],
      stock_deduct: 2,
      current_stock: 8,
      current_cash: 1200
    }

    expect(response.current_stock).toBe(8)
  })
})
