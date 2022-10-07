import { Call, CallHandler, Logger } from '@distributed-functions/core';
import { ReactiveCounter } from '@fddf-ts/core/reactive-counter';
export declare type RabbitMqClientConfig = {
    host: string;
    port: number;
    username: string;
    password: string;
    heartbeat?: number;
    vhost?: string;
    prefix?: string;
    postfix?: string;
};
export declare const getQueueFullName: (queueName: string, prefix?: string, postfix?: string) => string;
export declare const REPLY_QUEUE: "amq.rabbitmq.reply-to";
export declare const RabbitMQTransport: {
    type: string;
    new: (props: {
        config: RabbitMqClientConfig;
        reactiveCounter?: ReactiveCounter;
        strategy?: 'local-first' | 'remote-first';
        reconnect?: boolean;
        deafultPrefetch?: number;
        timeout?: number;
        onConnectCallback?: () => any;
        logger?: Logger;
    }) => {
        init: () => Promise<void>;
        subscribe: <Ctx extends Record<any, any>, Deps extends Record<string, Call<any, any, any, any>>, Cl extends Call<any, any, any, any>>(df: CallHandler<Ctx, Deps, Cl>, ctx: () => Ctx) => Promise<void>;
        publish: <C extends Call<any, any, any, any>>(requestData: ReturnType<C["request"]>) => Promise<ReturnType<C["result"]>>;
        destroy: () => Promise<void>;
        checkDfExistence: (dfCallName: string) => Promise<boolean | undefined>;
    };
};
