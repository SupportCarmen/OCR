/**
 * Utility to generate Carmen URLs dynamically based on the current tenant.
 * Derives tenant from subdomain (e.g., tenant.carmen4.com).
 * Defaults to 'dev' if on localhost or no subdomain.
 */
export function getCarmenUrl(path = '') {
  const host = window.location.hostname
  const parts = host.split('.')
  
  let tenant = 'dev'
  if (parts.length >= 3 && parts[0] !== 'localhost') {
    tenant = parts[0]
  }

  // Ensure path starts with / if provided
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `https://${tenant}.carmen4.com/#${normalizedPath}`
}
