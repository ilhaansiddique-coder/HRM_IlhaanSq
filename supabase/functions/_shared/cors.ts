// Secure CORS configuration - NEVER use '*' in production
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

// Default production domains - add your domain here
const defaultAllowedOrigins = [
  'https://rahestock.com',
  'https://www.rahestock.com',
  'https://rahestock.vercel.app',
  // Local/LAN app hosts used in this project.
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:8081',
  'http://192.168.0.127:8080',
  'http://192.168.0.127:8081',
]

const allAllowedOrigins = [...new Set([...defaultAllowedOrigins, ...allowedOrigins])]
const allowedDevPorts = new Set(['3000', '5173', '8080', '8081'])

const isPrivateIpv4Host = (host: string): boolean => {
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/i.test(host)) return true
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/i.test(host)) return true

  const match = host.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/i)
  if (!match) return false

  const secondOctet = Number(match[1])
  return secondOctet >= 16 && secondOctet <= 31
}

const isAllowedLanDevOrigin = (origin: string): boolean => {
  try {
    const url = new URL(origin)
    const isHttp = url.protocol === 'http:'
    const hasAllowedPort = allowedDevPorts.has(url.port)

    return isHttp && hasAllowedPort && isPrivateIpv4Host(url.hostname)
  } catch {
    return false
  }
}

// Security headers to include in all responses
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'",
}

// Base CORS headers - NO wildcard allowed
export const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret, x-admin-restore-secret',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Max-Age': '86400',
  ...securityHeaders,
}

export const getCorsHeaders = (req: Request) => {
  const origin = req.headers.get('Origin') ?? ''

  // Check if origin is in allowed list
  if (allAllowedOrigins.includes(origin) || isAllowedLanDevOrigin(origin)) {
    return {
      ...corsHeaders,
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin',
    }
  }

  // Reject unknown origins - return null origin
  return {
    ...corsHeaders,
    'Access-Control-Allow-Origin': 'null',
    'Vary': 'Origin',
  }
}

// Helper to create a CORS preflight response
export const handleCorsPreflightRequest = (req: Request) => {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(req),
  })
}

// Helper to check if request is from allowed origin
export const isAllowedOrigin = (req: Request): boolean => {
  const origin = req.headers.get('Origin') ?? ''
  return allAllowedOrigins.includes(origin) || isAllowedLanDevOrigin(origin)
}
