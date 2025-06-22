import { savePropertyMetadata } from '@midwayjs/core';

export const AUTH_KEY = 'damen-auth';

export function Auth(description: string, customKey?: string): MethodDecorator {
    return (target, key) => {
        savePropertyMetadata(AUTH_KEY, {
            description,
            customKey
        }, target, key);
    };
}