export class CommonError extends Error {
    constructor(
        public message: string,
        public code: number = 1,
        public status: number = 500,
        public details?: any
    ) {
        super(message);
        this.name = 'CommonError';
    }
}

export class ValidationError extends CommonError {
    constructor(message: string, details?: any) {
        super(message, 1001, 400);
        this.name = 'ValidationError';
        this.details = details;
    }
}

export class UnauthorizedError extends CommonError {
    constructor(message = '未授权访问') {
        super(message, 2001, 401);
        this.name = 'UnauthorizedError';
    }
}

export class ForbiddenError extends CommonError {
    constructor(message = '权限不足') {
        super(message, 2002, 403);
        this.name = 'ForbiddenError';
    }
}

export class NotFoundError extends CommonError {
    constructor(message = '资源不存在') {
        super(message, 3001, 404);
        this.name = 'NotFoundError';
    }
}

export class BusinessError extends CommonError {
    constructor(message: string, code = 4001) {
        super(message, code, 400);
        this.name = 'BusinessError';
    }
}