import { describe, it, expect } from 'vitest'
import viteConfig from '../../vite.config.js'

describe('Port Configuration Validation', () => {
  it('should have vite dev server configured on port 3005', () => {
    expect(viteConfig).toBeDefined()
    expect(viteConfig.server).toBeDefined()
    expect(viteConfig.server.port).toBe(3005)
  })
})
