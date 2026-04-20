import type {
  GetStoreMembersReq,
  RecorderNameAddReq,
  RecorderNameDeleteReq,
  StoreInviteCreateReq,
  StoreMemberRemoveReq,
  StoreMemberSetRoleReq
} from '@somoke/shared'
import { rpc } from '../client'

export function getStoreMembers(req: GetStoreMembersReq = {}) {
  return rpc('getStoreMembers', req)
}

export function removeMember(req: StoreMemberRemoveReq) {
  return rpc('storeMemberRemove', req)
}

export function setMemberRole(req: StoreMemberSetRoleReq) {
  return rpc('storeMemberSetRole', req)
}

export function addRecorderName(req: RecorderNameAddReq) {
  return rpc('recorderNameAdd', req)
}

export function deleteRecorderName(req: RecorderNameDeleteReq) {
  return rpc('recorderNameDelete', req)
}

export function createInvite(req: StoreInviteCreateReq) {
  return rpc('storeInviteCreate', req)
}
