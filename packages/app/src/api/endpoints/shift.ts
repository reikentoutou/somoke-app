import type {
  GetShiftsReq,
  GetShiftsRes,
  ShiftConfigDeleteReq,
  ShiftConfigSaveReq
} from '@somoke/shared'
import { rpc, rpcCached } from '../client'

const SHIFTS_TTL_MS = 60_000

export function getShifts(req: GetShiftsReq = {}): Promise<GetShiftsRes> {
  return rpcCached('getShifts', req, {
    key: 'shifts:',
    ttlMs: SHIFTS_TTL_MS
  })
}

export function saveShift(req: ShiftConfigSaveReq) {
  return rpc('shiftConfigSave', req)
}

export function deleteShift(req: ShiftConfigDeleteReq) {
  return rpc('shiftConfigDelete', req)
}
