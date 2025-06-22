import { Provide, Scope, ScopeEnum, Init, Destroy, Config, Logger } from '@midwayjs/core';
import { Worker } from 'worker_threads';
import os = require('os');
import { ILogger } from '@midwayjs/logger';
import path = require('path');

@Provide()
@Scope(ScopeEnum.Singleton)
export class TaskService {
    private workers: Array<{
        id: number;
        worker: Worker;
        status: 'idle' | 'busy';
        currentTask: any;
        lastUsed: number;
    }> = [];

    private taskQueue: any[] = [];
    private idleTimers = new Map<number, NodeJS.Timeout>();
    private options: any;
    private size: number;

    @Config('threadPool')
    private threadConfig: any;

    @Logger()
    logger: ILogger;

    @Init()
    async init() {
        this.size = this.threadConfig?.size || os.cpus().length;

        this.options = Object.assign({
            idleTimeout: 30000,
            maxIdleThreads: Math.max(2, Math.floor(this.size * 0.5))
        }, this.threadConfig?.options || {});

        this.logger.info(`正在初始化线程池，大小: ${this.size}`);

        for (let i = 0; i < this.size; i++) {
            this.addWorker();
        }

        this.logger.info(`线程池已初始化，工作线程数: ${this.workers.length}`);
    }

    @Destroy()
    async destroy() {
        this.logger.info('正在销毁线程池...');

        this.idleTimers.forEach(timer => clearTimeout(timer));
        this.idleTimers.clear();

        const terminationPromises = this.workers.map(workerInfo => {
            return new Promise<void>((resolve) => {
                workerInfo.worker.once('exit', () => {
                    this.logger.info(`工作线程 #${workerInfo.id} 已终止`);
                    resolve();
                });
                workerInfo.worker.terminate();
            });
        });

        await Promise.all(terminationPromises);

        this.workers = [];
        this.taskQueue = [];

        this.logger.info('线程池已完全销毁');
    }

    private addWorker() {
        const workerPath = path.resolve(__dirname, 'pool.worker.js');


        const worker = new Worker(workerPath, {
            workerData: {
                isWorker: true,
                workerId: this.workers.length + 1
            }
        });

        const workerId = this.workers.length + 1;

        worker.on('message', (message: any) => {
            if (message.type === 'task_completed') {
                this.handleTaskCompleted(worker, message);
            }

            if (message.type === 'task_error') {
                this.handleTaskError(worker, message);
            }
        });

        worker.on('error', (err: Error) => {
            this.logger.error(`工作线程 #${workerId} 错误: ${err.message}`);
            this.replaceWorker(worker);
        });

        worker.on('exit', (code: number) => {
            if (code !== 0) {
                this.logger.warn(`工作线程 #${workerId} 异常退出，代码: ${code}`);
                this.replaceWorker(worker);
            } else {
                this.logger.info(`工作线程 #${workerId} 正常退出`);
            }
        });

        const workerInfo = {
            id: worker.threadId,
            worker,
            status: 'idle' as 'idle' | 'busy',
            currentTask: null as any,
            lastUsed: Date.now()
        };

        this.workers.push(workerInfo);
        this.resetIdleTimer(workerInfo);

        return workerId;
    }

    private handleTaskCompleted(worker: Worker, message: any) {
        const workerInfo = this.workers.find(w => w.worker === worker);
        if (!workerInfo) return;

        if (workerInfo.currentTask && workerInfo.currentTask.resolve) {
            workerInfo.currentTask.resolve(message.result);
        }

        workerInfo.status = 'idle';
        workerInfo.currentTask = null;
        workerInfo.lastUsed = Date.now();

        this.resetIdleTimer(workerInfo);
        this.processQueue();
    }

    private handleTaskError(worker: Worker, message: any) {
        const workerInfo = this.workers.find(w => w.worker === worker);
        if (!workerInfo) return;

        if (workerInfo.currentTask && workerInfo.currentTask.reject) {
            workerInfo.currentTask.reject(new Error(message.error));
        }

        workerInfo.status = 'idle';
        workerInfo.currentTask = null;
        workerInfo.lastUsed = Date.now();

        this.resetIdleTimer(workerInfo);
        this.processQueue();
    }

    private replaceWorker(oldWorker: Worker) {
        const index = this.workers.findIndex(w => w.worker === oldWorker);
        if (index !== -1) {
            this.workers.splice(index, 1);
            this.addWorker();
        }
    }

    private resetIdleTimer(workerInfo: any) {
        if (this.idleTimers.has(workerInfo.id)) {
            clearTimeout(this.idleTimers.get(workerInfo.id));
            this.idleTimers.delete(workerInfo.id);
        }

        if (this.workers.length > this.options.maxIdleThreads) {
            const timer = setTimeout(() => {
                this.cleanupIdleWorker(workerInfo);
            }, this.options.idleTimeout);

            this.idleTimers.set(workerInfo.id, timer);
        }
    }

    private cleanupIdleWorker(workerInfo: any) {
        if (workerInfo.status !== 'idle') return;
        if (this.workers.length <= this.options.maxIdleThreads) return;

        const index = this.workers.findIndex(w => w.id === workerInfo.id);
        if (index !== -1) {
            this.logger.info(`清理空闲工作线程 #${workerInfo.id}`);
            workerInfo.worker.terminate();
            this.workers.splice(index, 1);
            this.idleTimers.delete(workerInfo.id);
        }
    }


    private processQueue() {
        const idleWorker = this.workers.find(w => w.status === 'idle');

        if (idleWorker && this.taskQueue.length > 0) {
            const task = this.taskQueue.shift();
            this.assignTask(idleWorker, task);
        }
    }

    private assignTask(workerInfo: any, task: any) {
        workerInfo.status = 'busy';
        workerInfo.currentTask = task;

        if (this.idleTimers.has(workerInfo.id)) {
            clearTimeout(this.idleTimers.get(workerInfo.id));
            this.idleTimers.delete(workerInfo.id);
        }

        workerInfo.worker.postMessage({
            type: 'run_task',
            task: {
                taskFunc: task.taskFunc,
                args: task.args,
                taskId: task.taskId
            }
        });
    }

    run<T = any>(func: (...args: any[]) => T | Promise<T>, ...args: any[]): Promise<T> {
        return new Promise((resolve, reject) => {
            const task = {
                taskId: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                taskFunc: func.toString(),
                args: JSON.parse(JSON.stringify(args)),
                resolve,
                reject
            };

            this.taskQueue.push(task);
            this.processQueue();
        });
    }


    all(tasks: Promise<any>[]): Promise<any[]> {
        return Promise.all(tasks);
    }


    one(tasks: Promise<any>[]): Promise<any> {
        return new Promise(resolve => {
            const wrapTask = (task: Promise<any>) =>
                task.then(
                    result => ({ status: 'fulfilled', result }),
                    error => ({ status: 'rejected', error })
                );

            Promise.race(tasks.map(wrapTask)).then(resolve);
        });
    }


    getStatus() {
        return {
            totalWorkers: this.workers.length,
            idleWorkers: this.workers.filter(w => w.status === 'idle').length,
            busyWorkers: this.workers.filter(w => w.status === 'busy').length,
            queuedTasks: this.taskQueue.length,
            idleTimers: this.idleTimers.size
        };
    }
}