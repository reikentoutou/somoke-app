export * from './client'
import { login, updateProfile } from './endpoints/auth'
import { adjustStock, listLedger, opsAction } from './endpoints/ledger'
import {
  addRecorderName,
  createInvite,
  deleteRecorderName,
  getStoreMembers,
  removeMember,
  setMemberRole
} from './endpoints/member'
import { addRecord, deleteRecord, getRecord, getRecords, updateRecord } from './endpoints/record'
import { deleteShift, getShifts, saveShift } from './endpoints/shift'
import { createStore, deleteStore, getStoreDetail, getStores, joinStore, switchStore, updateStore } from './endpoints/store'

export const authApi = { login, updateProfile }
export const ledgerApi = { listLedger, adjustStock, opsAction }
export const memberApi = {
  getStoreMembers,
  removeMember,
  setMemberRole,
  addRecorderName,
  deleteRecorderName,
  createInvite
}
export const recordApi = { getRecords, getRecord, addRecord, updateRecord, deleteRecord }
export const shiftApi = { getShifts, saveShift, deleteShift }
export const storeApi = {
  getStores,
  createStore,
  switchStore,
  joinStore,
  updateStore,
  deleteStore,
  getStoreDetail
}
