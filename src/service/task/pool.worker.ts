import { workerData, parentPort } from 'worker_threads';
import { VM } from 'vm2';

const isWorker = workerData?.isWorker ?? false;

if (isWorker) {
    const sandbox = {
        require: require,
        console: console,
        __filename: __filename,
        __dirname: __dirname,
        process: process,
        Buffer: Buffer,
        setImmediate: setImmediate,
        setTimeout: setTimeout,
        setInterval: setInterval,
        clearImmediate: clearImmediate,
        clearTimeout: clearTimeout,
        clearInterval: clearInterval
    };

    const vm = new VM({
        timeout: 30000,
        sandbox
    });

    const executeFunction = (funcString: string, args: any[]) => {
        try {
            try {
                const func = vm.run(`(${funcString})`);
                return func(...args);
            } catch (vmError: any) {
                if (vmError.code === 'MODULE_NOT_FOUND') {
                    const func = new Function(`return ${funcString}`)();
                    return func(...args);
                }
                throw vmError;
            }
        } catch (error: any) {
            throw new Error(`Function execution failed: ${error.message}`);
        }
    };

    parentPort?.on('message', async (message: any) => {
        if (message.type === 'run_task') {
            const { task } = message;
            const startTime = Date.now();

            try {
                const result = await executeFunction(task.taskFunc, task.args);
                const duration = Date.now() - startTime;

                parentPort?.postMessage({
                    type: 'task_completed',
                    task: message.task,
                    result,
                    duration
                });
            } catch (error: any) {
                parentPort?.postMessage({
                    type: 'task_error',
                    task: message.task,
                    error: error.message || error.toString()
                });
            }
        }
    });

    const minimizeMemory = () => {
        if (typeof global.gc === 'function') {
            global.gc();
        }
    };
    setInterval(minimizeMemory, 600000);
    minimizeMemory();
} else {
    console.error('该线程只能运行于worker线程中');
}