import { decodeProtectedHeader, importJWK, jwtVerify, type JWK } from 'jose'
import { createHash, timingSafeEqual } from 'crypto'
import { plaidClient } from './client'

export class WebhookVerificationError extends Error {}

// Plaid verification keys are static per `kid` (no rotation within a key's
// lifetime), and this app's webhook volume is low, so an in-memory cache
// with no TTL is sufficient — no key-rotation infra needed.
const keyCache = new Map<string, JWK>()

export async function verifyPlaidWebhook(
  rawBody: string,
  verificationJwt: string | null
): Promise<void> {
  if (!verificationJwt) {
    throw new WebhookVerificationError('Missing Plaid-Verification header')
  }

  let kid: string
  try {
    const header = decodeProtectedHeader(verificationJwt)
    if (header.alg !== 'ES256') {
      throw new WebhookVerificationError(`Unexpected alg: ${header.alg}`)
    }
    if (!header.kid) {
      throw new WebhookVerificationError('Missing kid in verification header')
    }
    kid = header.kid
  } catch (err) {
    if (err instanceof WebhookVerificationError) throw err
    throw new WebhookVerificationError('Malformed verification header')
  }

  let jwk = keyCache.get(kid)
  if (!jwk) {
    const { data } = await plaidClient.webhookVerificationKeyGet({ key_id: kid })
    if (data.key.expired_at) {
      throw new WebhookVerificationError('Verification key has expired')
    }
    jwk = data.key as unknown as JWK
    keyCache.set(kid, jwk)
  }

  let payload
  try {
    const keyLike = await importJWK(jwk, 'ES256')
    ;({ payload } = await jwtVerify(verificationJwt, keyLike, { maxTokenAge: '5 min' }))
  } catch {
    throw new WebhookVerificationError('Signature verification failed')
  }

  const expectedHash = payload.request_body_sha256
  if (typeof expectedHash !== 'string') {
    throw new WebhookVerificationError('Missing request_body_sha256 claim')
  }

  const actualHash = createHash('sha256').update(rawBody).digest('hex')
  const expectedBuf = Buffer.from(expectedHash, 'hex')
  const actualBuf = Buffer.from(actualHash, 'hex')
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    throw new WebhookVerificationError('Request body hash mismatch')
  }
}
