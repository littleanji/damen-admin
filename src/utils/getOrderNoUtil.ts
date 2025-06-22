export async function getOrderNo(
    lastRecord: string,
    prefix: string
): Promise<string> {
    const today = new Date();
    const dateStr = `${today.getFullYear()}${(today.getMonth() + 1)
        .toString()
        .padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;

    const nextSequence = lastRecord ? parseInt(lastRecord.split('-')[lastRecord.split('-').length - 1]) + 1 : 1;

    const sequenceStr = nextSequence.toString().padStart(4, '0');

    const serialNumber = `${prefix}-${dateStr}-${sequenceStr}`;

    return serialNumber;
}