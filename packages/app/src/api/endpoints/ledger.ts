import type { OpsActionReq, StockAdjustReq, StockLedgerListReq } from '@somoke/shared'
import { rpc } from '../client'

export function listLedger(req: StockLedgerListReq) {
  return rpc('stockLedgerList', req)
}

export function adjustStock(req: StockAdjustReq) {
  return rpc('stockAdjust', req)
}

export function opsAction(req: OpsActionReq) {
  return rpc('opsAction', req)
}
