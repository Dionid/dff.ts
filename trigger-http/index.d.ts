import { Call, Trigger } from '@distributed-functions/core';
export declare const HttpTrigger: {
    new: <Deps extends Record<string, Call<any, any, any, any>>>(props: {
        calls: Array<Call<any, any, any, any>>;
        config?: {
            port?: number;
            path?: string;
        };
    }) => Trigger<Deps>;
};
