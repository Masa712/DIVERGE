/**
 * Guest Rate Limiter
 * IPアドレスベースのレート制限
 * Redisが利用可能な場合はRedisを使用、そうでない場合はインメモリ
 */

import { GUEST_LIMITS } from './guest-session'

// レート制限の設定
const RATE_LIMIT_CONFIG = {
  maxRequests: GUEST_LIMITS.ipRateLimit?.requests || 100,
  windowMs: GUEST_LIMITS.ipRateLimit?.windowMs || 60 * 60 * 1000, // 1時間
}

// インメモリストア（Redisが利用できない場合のフォールバック）
const inMemoryStore = new Map<string, { count: number; resetAt: number }>()

// 定期的にインメモリストアをクリーンアップ
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    const keysToDelete: string[] = []
    inMemoryStore.forEach((value, key) => {
      if (value.resetAt < now) {
        keysToDelete.push(key)
      }
    })
    keysToDelete.forEach(key => inMemoryStore.delete(key))
  }, 60 * 1000) // 1分ごとにクリーンアップ
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfter?: number
}

/**
 * Redisを使用したレート制限チェック
 */
async function checkRateLimitWithRedis(ip: string): Promise<RateLimitResult | null> {
  try {
    // Redisクライアントを動的にインポート
    const { getRedisClient } = await import('@/lib/redis/client')
    const redis = await getRedisClient()

    if (!redis) return null

    const key = `guest_rate_limit:${ip}`
    const now = Date.now()
    const windowStart = now - RATE_LIMIT_CONFIG.windowMs

    // Sorted Setを使用して時間ベースのレート制限
    // 古いエントリを削除
    await redis.zremrangebyscore(key, 0, windowStart)

    // 現在のカウントを取得
    const currentCount = await redis.zcard(key)

    if (currentCount >= RATE_LIMIT_CONFIG.maxRequests) {
      // 最も古いエントリの時間を取得してretryAfterを計算
      const oldestEntries = await redis.zrange(key, 0, 0, 'WITHSCORES')
      const oldestTime = oldestEntries.length > 1 ? parseInt(oldestEntries[1], 10) : now
      const retryAfter = Math.ceil((oldestTime + RATE_LIMIT_CONFIG.windowMs - now) / 1000)

      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.max(retryAfter, 1),
      }
    }

    // 新しいエントリを追加
    await redis.zadd(key, now, `${now}:${Math.random()}`)
    await redis.expire(key, Math.ceil(RATE_LIMIT_CONFIG.windowMs / 1000))

    return {
      allowed: true,
      remaining: RATE_LIMIT_CONFIG.maxRequests - currentCount - 1,
    }
  } catch (error) {
    console.warn('Redis rate limit check failed, falling back to in-memory:', error)
    return null
  }
}

/**
 * インメモリレート制限チェック
 */
function checkRateLimitInMemory(ip: string): RateLimitResult {
  const now = Date.now()
  const key = `guest:${ip}`
  const entry = inMemoryStore.get(key)

  if (!entry || entry.resetAt < now) {
    // 新しいウィンドウを開始
    inMemoryStore.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_CONFIG.windowMs,
    })
    return {
      allowed: true,
      remaining: RATE_LIMIT_CONFIG.maxRequests - 1,
    }
  }

  if (entry.count >= RATE_LIMIT_CONFIG.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    }
  }

  // カウントを増加
  entry.count++
  inMemoryStore.set(key, entry)

  return {
    allowed: true,
    remaining: RATE_LIMIT_CONFIG.maxRequests - entry.count,
  }
}

/**
 * ゲストユーザーのレート制限をチェック
 */
export async function checkGuestRateLimit(ip: string): Promise<RateLimitResult> {
  // 開発環境ではlocalhostからのリクエストを許可
  if (process.env.NODE_ENV === 'development' && (ip === '127.0.0.1' || ip === '::1' || ip === 'unknown')) {
    return { allowed: true, remaining: RATE_LIMIT_CONFIG.maxRequests }
  }

  // Redisを試行
  const redisResult = await checkRateLimitWithRedis(ip)
  if (redisResult !== null) {
    return redisResult
  }

  // Redisが利用できない場合はインメモリを使用
  return checkRateLimitInMemory(ip)
}

/**
 * レート制限をリセット（テスト用）
 */
export async function resetGuestRateLimit(ip: string): Promise<void> {
  const key = `guest:${ip}`
  inMemoryStore.delete(key)

  try {
    const { getRedisClient } = await import('@/lib/redis/client')
    const redis = await getRedisClient()
    if (redis) {
      await redis.del(`guest_rate_limit:${ip}`)
    }
  } catch {
    // Redisがない場合は無視
  }
}
