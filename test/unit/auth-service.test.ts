import { afterEach, describe, expect, it } from 'vitest'
import { resolveIdentity } from '../../src/auth/service.js'
import { setDemoMode } from '../../src/auth/demo-mode.js'

describe('resolveIdentity', () => {
  it('resolves persisted bearer tokens from staticKeys', () => {
    const identity = resolveIdentity('Bearer persisted-token', {
      mode: 'static_key',
      staticKeys: {
        'persisted-token': {
          userId: 'service-user',
          roles: ['user'],
        },
      },
    })

    expect(identity).toEqual({
      sub: 'service-user',
      roles: ['user'],
    })
  })

  it('returns anonymous when bearer token is not persisted', () => {
    const identity = resolveIdentity('Bearer inspector:admin', {
      mode: 'static_key',
      staticKeys: {
        persisted: {
          userId: 'service-user',
          roles: ['user'],
        },
      },
    })

    expect(identity).toEqual({ sub: 'anonymous', roles: [] })
  })

  describe('demo mode', () => {
    afterEach(() => {
      setDemoMode(false)
    })

    it('DEMO_MODE=true always returns anonymous identity even with valid static key', () => {
      setDemoMode(true)
      const result = resolveIdentity('Bearer valid-token', {
        mode: 'static_key',
        staticKeys: {
          'valid-token': { userId: 'admin', roles: ['admin'] },
        },
      })
      expect(result).toEqual({ sub: 'anonymous', roles: [] })
    })
  })
})
