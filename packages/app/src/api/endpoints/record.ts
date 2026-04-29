import type {
  AddRecordReq,
  DeleteRecordReq,
  GetRecordReq,
  GetRecordsReq,
  UpdateRecordReq
} from '@somoke/shared'
import { rpc } from '../client'

export function getRecords(req: GetRecordsReq = {}) {
  return rpc('getRecords', req)
}

export function getRecord(req: GetRecordReq) {
  return rpc('getRecord', req)
}

export function addRecord(req: AddRecordReq) {
  return rpc('addRecord', req)
}

export function updateRecord(req: UpdateRecordReq) {
  return rpc('updateRecord', req)
}

export function deleteRecord(req: DeleteRecordReq) {
  return rpc('deleteRecord', req)
}
