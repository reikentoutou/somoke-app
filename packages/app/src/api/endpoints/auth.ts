import type { LoginReq, UpdateProfileReq } from '@somoke/shared'
import { rpc } from '../client'

export function login(req: LoginReq = {}) {
  return rpc('login', req)
}

export function updateProfile(req: UpdateProfileReq) {
  return rpc('updateProfile', req)
}
