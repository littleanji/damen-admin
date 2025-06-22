import { Provide, Inject, ScopeEnum, Scope } from '@midwayjs/core';
import { RedisService } from '@midwayjs/redis';
import { v7 as uuidv7 } from 'uuid';
import { asyncLocalStorage } from '../../db/context';

interface RedisLockOptions {
    retryDelay?: number;
    maxRetries?: number;
    lockTimeout?: number;
    spinTimeout?: number;
    renewalInterval?: number;
}

@Provide()
@Scope(ScopeEnum.Request, { allowDowngrade: true })
export class RedisServiceManage {
    @Inject()
    redisService: RedisService;


    async get(key: string): Promise<string | null> {
        return this.redisService.get(key);
    }


    async set(key: string, value: string, ttl?: number): Promise<void> {
        if (ttl) {
            await this.redisService.set(key, value, 'EX', ttl);
        } else {
            await this.redisService.set(key, value);
        }
    }


    async del(key: string): Promise<void> {
        await this.redisService.del(key);
    }


    async getJson<T>(key: string): Promise<T | null> {
        const data = await this.get(key);
        return data ? JSON.parse(data) : null;
    }


    async saveJson(key: string, value: any, ttl?: number): Promise<void> {
        await this.set(key, JSON.stringify(value), ttl);
    }


    private renewalTimers: Map<string, NodeJS.Timeout> = new Map();

    async Lock<T>(
        lockSeed: string,
        handler: () => Promise<T>,
        options: RedisLockOptions = {}
    ): Promise<T> {
        const {
            retryDelay = 100,
            maxRetries = 10,
            lockTimeout = 3000,
            spinTimeout = 5000,
            renewalInterval = Math.floor(lockTimeout / 3)
        } = options;

        const lockId = uuidv7();
        const startTime = Date.now();
        let acquired = false;

        const tenantId = asyncLocalStorage.getStore()?.tenantId || 'host';

        const lockKey = `lock:${tenantId}_${lockSeed}`;

        try {
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                const result = await this.redisService.set(
                    lockKey,
                    lockId,
                    'PX',
                    lockTimeout,
                    'NX'
                );

                if (result === 'OK') {
                    acquired = true;
                    this.startRenewal(lockKey, lockId, renewalInterval, lockTimeout);
                    break;
                }

                if (Date.now() - startTime > spinTimeout) {
                    throw new Error(`Lock acquisition timed out for key: ${lockKey}`);
                }

                const jitterDelay = retryDelay * (1 + Math.random());
                await new Promise(resolve => setTimeout(resolve, jitterDelay));
            }

            if (!acquired) {
                throw new Error(`Failed to acquire lock for key: ${lockKey} after ${maxRetries} attempts`);
            }

            return await handler();
        } finally {
            if (acquired) {
                this.stopRenewal(lockKey);
                await this.releaseLock(lockKey, lockId);
            }
        }
    }


    private startRenewal(
        lockKey: string,
        lockId: string,
        interval: number,
        timeout: number
    ) {
        const renewalTimer = setInterval(async () => {
            try {
                const luaScript = `
          if redis.call("GET", KEYS[1]) == ARGV[1] then
            return redis.call("PEXPIRE", KEYS[1], ARGV[2])
          else
            return 0
          end
        `;

                const result = await this.redisService.eval(
                    luaScript,
                    1,
                    lockKey,
                    lockId,
                    timeout
                );

                if (result !== 1) {
                    this.stopRenewal(lockKey);
                }
            } catch (error) {
                console.error(`Lock renewal failed for ${lockKey}:`, error);
                this.stopRenewal(lockKey);
            }
        }, interval);

        this.renewalTimers.set(lockKey, renewalTimer);
    }


    private stopRenewal(lockKey: string) {
        const timer = this.renewalTimers.get(lockKey);
        if (timer) {
            clearInterval(timer);
            this.renewalTimers.delete(lockKey);
        }
    }


    private async releaseLock(lockKey: string, lockId: string) {
        try {
            const luaScript = `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("DEL", KEYS[1])
        else
          return 0
        end
      `;

            await this.redisService.eval(luaScript, 1, lockKey, lockId);
        } catch (error) {
            console.error(`Lock release failed for ${lockKey}:`, error);

        }
    }



}