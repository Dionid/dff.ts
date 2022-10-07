import { JSONValue } from '@fddf-ts/core/jsonvalue';
export declare class ReplyTimeoutError extends Error {
    constructor(correlationId: string, data: JSONValue);
}
