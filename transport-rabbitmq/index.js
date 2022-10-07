"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RabbitMQTransport = exports.REPLY_QUEUE = exports.getQueueFullName = void 0;
const events_1 = require("events");
const core_1 = require("@distributed-functions/core");
const categorized_errors_1 = require("@fddf-ts/core/categorized-errors");
const amqplib_1 = __importDefault(require("amqplib"));
const errors_1 = require("./errors");
const getQueueFullName = (queueName, prefix, postfix) => {
    if (queueName === '') {
        return '';
    }
    return [prefix, queueName, postfix].filter((_) => !!_).join('-');
};
exports.getQueueFullName = getQueueFullName;
// TODO. Fix this
const requestParserValidate = (requestParser, asJson) => {
    Object.keys(requestParser).map((key) => {
        const val = requestParser[key];
        const jsonVal = asJson[key];
        if (!jsonVal || !val) {
            throw new categorized_errors_1.ValidationError(`Param ${key} is required`);
        }
        if (val instanceof Function) {
            val(key, jsonVal);
        }
        else {
            requestParserValidate(val, jsonVal);
        }
    });
};
const initConnection = async (logger, config, onConnectCallback) => {
    const connectionOptions = {
        hostname: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        heartbeat: config.heartbeat || 10
    };
    if (config.vhost) {
        connectionOptions.vhost = config.vhost;
    }
    logger.info(`try to connection to rabbit host: ${connectionOptions.hostname}, port: ${connectionOptions.port}`);
    const connection = await amqplib_1.default.connect(connectionOptions);
    connection.on('error', () => {
        logger.error('connection on error callback: %o');
    });
    logger.info(`connected`);
    if (onConnectCallback) {
        logger.info('_onConnectCallback running...');
        try {
            await onConnectCallback();
        }
        catch (e) {
            logger.error('error in _onConnectCallback');
            throw e;
        }
        logger.info('_onConnectCallback finished success');
    }
    return connection;
};
exports.REPLY_QUEUE = 'amq.rabbitmq.reply-to';
exports.RabbitMQTransport = {
    type: 'RabbitMQTransport',
    new: (props) => {
        const { config, onConnectCallback, reactiveCounter, strategy = 'local-first', reconnect = true, deafultPrefetch, timeout = 30000 } = props;
        const logger = (props === null || props === void 0 ? void 0 : props.logger) || {
            info: console.log,
            error: console.error,
            warn: console.warn
        };
        const inmemoryTransport = core_1.InmemoryTransport.new({
            reactiveCounter,
            logger
        });
        const responseEmitter = new events_1.EventEmitter();
        responseEmitter.setMaxListeners(0);
        let connection;
        let globalChannel;
        const subs = [];
        const publish = async (requestData) => {
            const localSub = inmemoryTransport.getSub(requestData.name);
            if (localSub && strategy === 'local-first' && !localSub.df.persistent) {
                return inmemoryTransport.publish(requestData);
            }
            return new Promise((resolve, reject) => {
                // QUESTION. Do we need to wait till response
                // reactiveCounter.increment();
                let dataToSend;
                if (!requestData) {
                    throw new Error(`Data is required`);
                }
                else if (typeof requestData === 'string') {
                    dataToSend = Buffer.from(requestData);
                }
                else {
                    dataToSend = Buffer.from(JSON.stringify(requestData));
                }
                const correlationId = requestData.id;
                // # Add request timeout
                const tid = setTimeout(() => {
                    // reactiveCounter.decrement();
                    responseEmitter.removeAllListeners(correlationId);
                    reject(new errors_1.ReplyTimeoutError(correlationId, requestData));
                }, timeout);
                // # Listen for the content emitted on the correlationId event
                responseEmitter.once(correlationId, (data) => {
                    // reactiveCounter.decrement();
                    clearTimeout(tid);
                    resolve(JSON.parse(data.content.toString()) // TODO. Add parser
                    );
                });
                globalChannel.sendToQueue((0, exports.getQueueFullName)(requestData.name, config.prefix, config.postfix), dataToSend, {
                    correlationId,
                    replyTo: exports.REPLY_QUEUE,
                    contentType: 'application/json'
                });
            });
        };
        const subscribe = async (df, ctx) => {
            subs.push({
                df,
                ctx
            });
            const { depCalls: depCallsRaw, call, handler, persistent } = df;
            // TODO. Add prefetch in DF
            const prefetch = deafultPrefetch;
            const depCalls = {};
            for (const key of Object.keys(depCallsRaw)) {
                // # Publish dep call and return result
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                depCalls[key] = async (request) => {
                    return publish(request);
                };
            }
            const channel = await connection.createChannel();
            channel.on('connect', () => {
                logger.info('channel connected');
            });
            channel.on('error', (err) => {
                logger.error(err);
            });
            channel.on('close', () => {
                logger.info('local channel close');
            });
            if (prefetch) {
                await channel.prefetch(prefetch);
            }
            // # Check queue exist
            const q = await channel.assertQueue((0, exports.getQueueFullName)(call.name, config.prefix, config.postfix), {
                autoDelete: !persistent,
                durable: persistent
            }
            // TODO. # Turn back
            // {
            //   ...rmqc.defaultAssertQueueOptions,
            //   ...assertQueueOptions,
            // }
            );
            channel.consume(q.queue, async (msg) => {
                if (msg) {
                    try {
                        const asJson = JSON.parse(msg.content.toString());
                        const { requestParser } = call;
                        if (requestParser) {
                            requestParserValidate(requestParser, asJson.params);
                        }
                        if (reactiveCounter) {
                            reactiveCounter.increment();
                        }
                        try {
                            const res = await handler(asJson, ctx(), depCalls);
                            channel.publish('', // Default exchange in RabbitMQ called ""
                            msg.properties.replyTo, Buffer.from(JSON.stringify(res)), {
                                correlationId: msg.properties.correlationId,
                                contentType: 'application/json'
                                // TODO. # Turn back
                                //   ...rmqChannel.defaultPublishOptions,
                            });
                        }
                        finally {
                            if (reactiveCounter) {
                                reactiveCounter.decrement();
                            }
                        }
                    }
                    catch (e) {
                        let errorResponseData;
                        logger.error(e);
                        if (e instanceof categorized_errors_1.BaseError) {
                            errorResponseData = {
                                code: e.statusCode,
                                message: e.message
                            };
                        }
                        else {
                            errorResponseData = {
                                code: 500,
                                message: 'Internal Server Error'
                            };
                        }
                        channel.publish('', // Default exchange in RabbitMQ called ""
                        msg.properties.replyTo, Buffer.from(JSON.stringify({
                            id: msg.properties.correlationId,
                            error: errorResponseData
                        })), {
                            correlationId: msg.properties.correlationId,
                            contentType: 'application/json'
                            // TODO. # Turn back
                            //   ...rmqChannel.defaultPublishOptions,
                        });
                    }
                    finally {
                        channel.ack(msg);
                    }
                }
            }
            // TODO. # Turn back
            // consumeOptions
            );
            await inmemoryTransport.subscribe(df, ctx);
        };
        const init = async () => {
            // Create connection
            connection = await initConnection(logger, config, onConnectCallback);
            if (reconnect) {
                connection.on('close', () => {
                    logger.warn('reconnecting');
                    // . Create new connection on close and repeat forever
                    return setTimeout(async () => {
                        responseEmitter.removeAllListeners();
                        init();
                    }, 1000);
                });
            }
            // # Create channel
            globalChannel = await connection.createChannel();
            globalChannel.on('connect', () => {
                logger.info('channel connected');
            });
            globalChannel.on('error', (err) => {
                logger.error(err);
            });
            globalChannel.on('close', () => {
                logger.info('global channel close');
            });
            // # Subscribe on reply queues
            await globalChannel.consume(exports.REPLY_QUEUE, (msg) => {
                if (msg) {
                    responseEmitter.emit(msg.properties.correlationId, msg);
                }
            }, { noAck: true });
            await Promise.all(subs.map((sub) => {
                subscribe(sub.df, sub.ctx);
            }));
            await inmemoryTransport.init();
        };
        return {
            init,
            subscribe,
            publish,
            destroy: async () => {
                await connection.removeAllListeners().close();
                await inmemoryTransport.destroy();
            },
            checkDfExistence: async (dfCallName) => {
                if (await inmemoryTransport.checkDfExistence(dfCallName)) {
                    return true;
                }
                try {
                    const channel = await connection.createChannel();
                    return !!(await channel.checkQueue(dfCallName));
                }
                catch (e) {
                    if (e instanceof Error) {
                        if (e.message.includes('404')) {
                            return false;
                        }
                    }
                    throw e;
                }
            }
        };
    }
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsbUNBQXFDO0FBRXJDLHNEQVFvQztBQUNwQyx5RUFBNkU7QUFHN0Usc0RBQStFO0FBRS9FLHFDQUE0QztBQWFyQyxNQUFNLGdCQUFnQixHQUFHLENBQUMsU0FBaUIsRUFBRSxNQUFlLEVBQUUsT0FBZ0IsRUFBVSxFQUFFO0lBQy9GLElBQUksU0FBUyxLQUFLLEVBQUUsRUFBRTtRQUNwQixPQUFPLEVBQUUsQ0FBQTtLQUNWO0lBRUQsT0FBTyxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ2xFLENBQUMsQ0FBQTtBQU5ZLFFBQUEsZ0JBQWdCLG9CQU01QjtBQUVELGlCQUFpQjtBQUNqQixNQUFNLHFCQUFxQixHQUFHLENBQUMsYUFBaUMsRUFBRSxNQUFrQixFQUFFLEVBQUU7SUFDdEYsTUFBTSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRTtRQUNyQyxNQUFNLEdBQUcsR0FBRyxhQUFhLENBQUMsR0FBRyxDQUFDLENBQUE7UUFDOUIsTUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFBO1FBRTNCLElBQUksQ0FBQyxPQUFPLElBQUksQ0FBQyxHQUFHLEVBQUU7WUFDcEIsTUFBTSxJQUFJLG9DQUFlLENBQUMsU0FBUyxHQUFHLGNBQWMsQ0FBQyxDQUFBO1NBQ3REO1FBRUQsSUFBSSxHQUFHLFlBQVksUUFBUSxFQUFFO1lBQzNCLEdBQUcsQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUE7U0FDbEI7YUFBTTtZQUNMLHFCQUFxQixDQUFDLEdBQUcs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