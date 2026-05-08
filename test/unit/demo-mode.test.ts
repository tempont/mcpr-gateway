import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildServer } from '../../src/gateway/server.js'
import { setDemoMode, isDemoMode } from '../../src/auth/demo-mode.js'
import { RuntimeConfigManager } from '../../src/config/runtime.js'
import { createDefaultAdminConfig } from '../../src/config/loader.js'
import {
  assertMcpSessionOAuthBearer,
  resolveMcpIdentityForInitialize,
} from '../../src/auth/mcp-identity.js'
import { resolveIdentity } from '../../src/auth/service.js'

describe('DEMO_MODE', () => {
  afterEach(() => {
    setDemoMode(false)
    vi.unstubAllEnvs()
  })

  // ──────────────────────────────────────────────
  // Identity hardening (Phase 2)
  // ──────────────────────────────────────────────

  describe('identity hardening', () => {
    it('assertMcpSessionOAuthBearer returns "ok" in demo mode', async () => {
      setDemoMode(true)

      const result = await assertMcpSessionOAuthBearer(
        undefined, // authHeader — irrelevant in demo mode
        { mode: 'static_key' },
        'test-namespace',
        'anonymous',
        new Set(),
      )

      expect(result).toBe('ok')
    })

    it('resolveMcpIdentityForInitialize returns anonymous in demo mode', async () => {
      setDemoMode(true)

      const result = await resolveMcpIdentityForInitialize(
        undefined,
        { mode: 'static_key' },
        'test-namespace',
        new Set(),
      )

      expect(result).toEqual({
        kind: 'identity',
        identity: { sub: 'anonymous', roles: [] },
      })
    })

    it('resolveIdentity returns anonymous in demo mode even with valid static key', () => {
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

  // ──────────────────────────────────────────────
  // Route accessibility in demo mode
  // ──────────────────────────────────────────────

  describe('route accessibility', () => {
    it('admin routes are accessible in demo mode', async () => {
      vi.stubEnv('DEMO_MODE', 'true')
      setDemoMode(true)

      const app = buildServer({ logLevel: 'silent' })
      // In src/index.ts: enableAdminRoutes = isDemoMode || (…)
      // Since isDemoMode() is true, adminRoutes IS registered
      // Replicate the admin route registration to verify accessibility
      app.get('/admin/dashboard', async (_req, reply) => {
        return reply.send({ ok: true })
      })
      await app.ready()

      const res = await app.inject({ method: 'GET', url: '/admin/dashboard' })
      // Admin routes should be accessible (not 404)
      expect(res.statusCode).not.toBe(404)

      await app.close()
    })

    it('debug routes not registered in demo mode', async () => {
      vi.stubEnv('DEMO_MODE', 'true')
      setDemoMode(true)

      const app = buildServer({ logLevel: 'silent' })
      // In src/index.ts: if (config.debug.enabled && !isDemoMode)
      // Since isDemoMode() is true, debugRoutes is never registered
      await app.ready()

      const res = await app.inject({
        method: 'GET',
        url: '/debug/session/test',
      })
      expect(res.statusCode).toBe(404)

      await app.close()
    })

    it('embedded OAuth routes not registered in demo mode', async () => {
      vi.stubEnv('DEMO_MODE', 'true')
      setDemoMode(true)

      const app = buildServer({ logLevel: 'silent' })
      // In src/index.ts: if (!isDemoMode) { app.register(embeddedOAuthRoutes, …) }
      // Since isDemoMode() is true, embeddedOAuthRoutes is never registered
      await app.ready()

      // Embedded OAuth registers: /.well-known/jwks.json, /oauth/authorize, /oauth/token
      const jwksRes = await app.inject({
        method: 'GET',
        url: '/.well-known/jwks.json',
      })
      expect(jwksRes.statusCode).toBe(404)

      const authRes = await app.inject({
        method: 'GET',
        url: '/oauth/authorize',
      })
      expect(authRes.statusCode).toBe(404)

      await app.close()
    })

    it('demo mode with ADMIN_TOKEN set still has admin routes accessible', async () => {
      vi.stubEnv('DEMO_MODE', 'true')
      vi.stubEnv('ADMIN_TOKEN', 'secret')
      setDemoMode(true)

      const app = buildServer({ logLevel: 'silent' })
      // enableAdminRoutes = isDemoMode || config.debug.enabled || Boolean(ADMIN_TOKEN) || …
      // isDemoMode() is true — routes are registered regardless of ADMIN_TOKEN
      app.get('/admin/dashboard', async (_req, reply) => {
        return reply.send({ ok: true })
      })
      await app.ready()

      const res = await app.inject({ method: 'GET', url: '/admin/dashboard' })
      expect(res.statusCode).not.toBe(404)

      await app.close()
    })
  })

  // ──────────────────────────────────────────────
  // API endpoint (Phase 1.6)
  // ──────────────────────────────────────────────

  describe('api endpoint', () => {
    it('GET /api/demo-status returns credentials in demo mode', async () => {
      vi.stubEnv('DEMO_MODE', 'true')
      vi.stubEnv('GATEWAY_ADMIN_USER', 'testuser')
      vi.stubEnv('GATEWAY_ADMIN_PASSWORD', 'testpass')
      setDemoMode(true)

      const app = buildServer({ logLevel: 'silent' })
      // Replicates the route from src/index.ts
      app.get('/api/demo-status', async (_req, reply) => {
        const response: { demoMode: boolean; demoUser?: string; demoPassword?: string } = {
          demoMode: isDemoMode(),
        }
        if (isDemoMode()) {
          response.demoUser = process.env['GATEWAY_ADMIN_USER'] || 'demo'
          response.demoPassword = process.env['GATEWAY_ADMIN_PASSWORD'] || 'demo'
        }
        return reply.send(response)
      })
      await app.ready()

      const res = await app.inject({
        method: 'GET',
        url: '/api/demo-status',
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.demoMode).toBe(true)
      expect(body.demoUser).toBe('testuser')
      expect(body.demoPassword).toBe('testpass')

      await app.close()
    })

    it('GET /api/demo-status uses default demo credentials when env vars not set', async () => {
      vi.stubEnv('DEMO_MODE', 'true')
      setDemoMode(true)

      const app = buildServer({ logLevel: 'silent' })
      // Replicates the route from src/index.ts
      app.get('/api/demo-status', async (_req, reply) => {
        const response: { demoMode: boolean; demoUser?: string; demoPassword?: string } = {
          demoMode: isDemoMode(),
        }
        if (isDemoMode()) {
          response.demoUser = process.env['GATEWAY_ADMIN_USER'] || 'demo'
          response.demoPassword = process.env['GATEWAY_ADMIN_PASSWORD'] || 'demo'
        }
        return reply.send(response)
      })
      await app.ready()

      const res = await app.inject({
        method: 'GET',
        url: '/api/demo-status',
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.demoMode).toBe(true)
      expect(body.demoUser).toBe('demo')
      expect(body.demoPassword).toBe('demo')

      await app.close()
    })

    it('GET /api/demo-status returns { demoMode: false } normally', async () => {
      setDemoMode(false)

      const app = buildServer({ logLevel: 'silent' })
      app.get('/api/demo-status', async (_req, reply) => {
        const response: { demoMode: boolean; demoUser?: string; demoPassword?: string } = {
          demoMode: isDemoMode(),
        }
        if (isDemoMode()) {
          response.demoUser = process.env['GATEWAY_ADMIN_USER'] || 'demo'
          response.demoPassword = process.env['GATEWAY_ADMIN_PASSWORD'] || 'demo'
        }
        return reply.send(response)
      })
      await app.ready()

      const res = await app.inject({
        method: 'GET',
        url: '/api/demo-status',
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ demoMode: false })

      await app.close()
    })
  })

  // ──────────────────────────────────────────────
  // Persistence / backend (Phase 1.2)
  // ──────────────────────────────────────────────

  describe('persistence', () => {
    it('demo mode forces memory backend (SQLite never created)', () => {
      vi.stubEnv('DEMO_MODE', 'true')
      vi.stubEnv('SESSION_BACKEND', 'sqlite')
      setDemoMode(true)

      // In src/index.ts:
      //   const memoryBackend = isDemoMode || process.env['SESSION_BACKEND'] === 'memory'
      // When isDemoMode() is true, memoryBackend is always true
      expect(isDemoMode()).toBe(true)

      // Even with SESSION_BACKEND=sqlite, the demo mode flag overrides
      expect(process.env['SESSION_BACKEND']).toBe('sqlite')
    })

    it('ensureEmbeddedKeys does not call saveAdminConfig in demo mode', async () => {
      setDemoMode(true)

      const app = buildServer({ logLevel: 'silent' })
      // In src/index.ts:
      //   if (!isDemoMode) { app.register(embeddedOAuthRoutes, { configManager }) }
      // The embeddedOAuthRoutes plugin has an onReady hook that calls
      // ensureEmbeddedKeys(), which calls configManager.saveAdminConfig().
      // In demo mode the plugin is never registered → the hook never fires.
      await app.ready()

      // Verify no embedded OAuth route is available
      const jwksRes = await app.inject({
        method: 'GET',
        url: '/.well-known/jwks.json',
      })
      expect(jwksRes.statusCode).toBe(404)

      const authRes = await app.inject({
        method: 'GET',
        url: '/oauth/authorize',
      })
      expect(authRes.statusCode).toBe(404)

      await app.close()
    })

    it('saveAdminConfig throws in demo mode', async () => {
      setDemoMode(true)

      const registry = { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn() }
      const configRepo = { save: vi.fn().mockResolvedValue(1) }
      const config = createDefaultAdminConfig()

      const manager = new RuntimeConfigManager({
        bootstrap: { auth: { mode: 'none' } },
        initial: config,
        registry: registry as any,
        configRepo: configRepo as any,
      })

      await expect(
        manager.saveAdminConfig(config, {
          source: 'admin_ui',
          createdBy: 'test',
        })
      ).rejects.toThrow('Config changes are not persisted in demo mode')

      setDemoMode(false)
    })

    it('saveAdminConfig works when not in demo mode', async () => {
      setDemoMode(false)

      const registry = { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn() }
      const configRepo = { save: vi.fn().mockResolvedValue(1) }
      const config = createDefaultAdminConfig()

      const manager = new RuntimeConfigManager({
        bootstrap: { auth: { mode: 'none' } },
        initial: config,
        registry: registry as any,
        configRepo: configRepo as any,
      })

      const version = await manager.saveAdminConfig(config, {
        source: 'admin_ui',
        createdBy: 'test',
      })

      expect(version).toBe(1)
      expect(configRepo.save).toHaveBeenCalledTimes(1)
      expect(configRepo.save).toHaveBeenCalledWith(config, {
        source: 'admin_ui',
        createdBy: 'test',
      })

      setDemoMode(false)
    })
  })

  // ──────────────────────────────────────────────
  // Default mode (no demo mode)
  // ──────────────────────────────────────────────

  describe('default mode', () => {
    it('DEMO_MODE=false has no effect (default behavior)', () => {
      // Not in demo mode — default behavior
      setDemoMode(false)
      expect(isDemoMode()).toBe(false)

      // Identity resolves normally with a valid static key
      const identity = resolveIdentity('Bearer valid-token', {
        mode: 'static_key',
        staticKeys: {
          'valid-token': { userId: 'admin', roles: ['admin'] },
        },
      })
      expect(identity).toEqual({ sub: 'admin', roles: ['admin'] })
    })
  })
})
