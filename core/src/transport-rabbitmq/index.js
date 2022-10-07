"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.RabbitMQTransport = exports.REPLY_QUEUE = exports.getQueueFullName = void 0;
var categorized_errors_1 = require("@fddf-ts/core/categorized-errors");
var amqplib_1 = require("amqplib");
var events_1 = require("events");
var transport_inmemory_1 = require("../transport-inmemory");
var errors_1 = require("./errors");
var getQueueFullName = function (queueName, prefix, postfix) {
    if (queueName === '') {
        return '';
    }
    return [prefix, queueName, postfix].filter(function (_) { return !!_; }).join('-');
};
exports.getQueueFullName = getQueueFullName;
// TODO. Fix this
var requestParserValidate = function (requestParser, asJson) {
    Object.keys(requestParser).map(function (key) {
        var val = requestParser[key];
        var jsonVal = asJson[key];
        if (!jsonVal || !val) {
            throw new categorized_errors_1.ValidationError("Param ".concat(key, " is required"));
        }
        if (val instanceof Function) {
            val(key, jsonVal);
        }
        else {
            requestParserValidate(val, jsonVal);
        }
    });
};
var initConnection = function (logger, config, onConnectCallback) { return __awaiter(void 0, void 0, void 0, function () {
    var connectionOptions, connection, e_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                connectionOptions = {
                    hostname: config.host,
                    port: config.port,
                    username: config.username,
                    password: config.password,
                    heartbeat: config.heartbeat || 10
                };
                if (config.vhost) {
                    connectionOptions.vhost = config.vhost;
                }
                logger.info("try to connection to rabbit host: ".concat(connectionOptions.hostname, ", port: ").concat(connectionOptions.port));
                return [4 /*yield*/, amqplib_1["default"].connect(connectionOptions)];
            case 1:
                connection = _a.sent();
                connection.on('error', function () {
                    logger.error('connection on error callback: %o');
                });
                logger.info("connected");
                if (!onConnectCallback) return [3 /*break*/, 6];
                logger.info('_onConnectCallback running...');
                _a.label = 2;
            case 2:
                _a.trys.push([2, 4, , 5]);
                return [4 /*yield*/, onConnectCallback()];
            case 3:
                _a.sent();
                return [3 /*break*/, 5];
            case 4:
                e_1 = _a.sent();
                logger.error('error in _onConnectCallback');
                throw e_1;
            case 5:
                logger.info('_onConnectCallback finished success');
                _a.label = 6;
            case 6: return [2 /*return*/, connection];
        }
    });
}); };
exports.REPLY_QUEUE = 'amq.rabbitmq.reply-to';
exports.RabbitMQTransport = {
    type: 'RabbitMQTransport',
    "new": function (props) {
        var config = props.config, onConnectCallback = props.onConnectCallback, reactiveCounter = props.reactiveCounter, _a = props.strategy, strategy = _a === void 0 ? 'local-first' : _a, _b = props.reconnect, reconnect = _b === void 0 ? true : _b, deafultPrefetch = props.deafultPrefetch, _c = props.timeout, timeout = _c === void 0 ? 30000 : _c;
        var logger = (props === null || props === void 0 ? void 0 : props.logger) || {
            info: console.log,
            error: console.error,
            warn: console.warn
        };
        var inmemoryTransport = transport_inmemory_1.InmemoryTransport["new"]({
            reactiveCounter: reactiveCounter,
            logger: logger
        });
        var responseEmitter = new events_1.EventEmitter();
        responseEmitter.setMaxListeners(0);
        var connection;
        var globalChannel;
        var subs = [];
        var publish = function (requestData) { return __awaiter(void 0, void 0, void 0, function () {
            var localSub;
            return __generator(this, function (_a) {
                localSub = inmemoryTransport.getSub(requestData.name);
                if (localSub && strategy === 'local-first' && !localSub.df.persistent) {
                    return [2 /*return*/, inmemoryTransport.publish(requestData)];
                }
                return [2 /*return*/, new Promise(function (resolve, reject) { return __awaiter(void 0, void 0, void 0, function () {
                        var dataToSend, correlationId, tid;
                        return __generator(this, function (_a) {
                            if (!requestData) {
                                throw new Error("Data is required");
                            }
                            else if (typeof requestData === 'string') {
                                dataToSend = Buffer.from(requestData);
                            }
                            else {
                                dataToSend = Buffer.from(JSON.stringify(requestData));
                            }
                            correlationId = requestData.id;
                            tid = setTimeout(function () {
                                // reactiveCounter.decrement();
                                responseEmitter.removeAllListeners(correlationId);
                                reject(new errors_1.ReplyTimeoutError(correlationId, requestData));
                            }, timeout);
                            // # Listen for the content emitted on the correlationId event
                            responseEmitter.once(correlationId, function (data) {
                                // reactiveCounter.decrement();
                                clearTimeout(tid);
                                resolve(JSON.parse(data.content.toString()) // TODO. Add parser
                                );
                            });
                            globalChannel.sendToQueue((0, exports.getQueueFullName)(requestData.name, config.prefix, config.postfix), dataToSend, {
                                correlationId: correlationId,
                                replyTo: exports.REPLY_QUEUE,
                                contentType: 'application/json'
                            });
                            return [2 /*return*/];
                        });
                    }); })];
            });
        }); };
        var subscribe = function (df, ctx) { return __awaiter(void 0, void 0, void 0, function () {
            var depCallsRaw, call, handler, persistent, prefetch, depCalls, _i, _a, key, channel, q;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        subs.push({
                            df: df,
                            ctx: ctx
                        });
                        depCallsRaw = df.depCalls, call = df.call, handler = df.handler, persistent = df.persistent;
                        prefetch = deafultPrefetch;
                        depCalls = {};
                        for (_i = 0, _a = Object.keys(depCallsRaw); _i < _a.length; _i++) {
                            key = _a[_i];
                            // # Publish dep call and return result
                            // @ts-ignore
                            depCalls[key] = function (request) { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    return [2 /*return*/, publish(request)];
                                });
                            }); };
                        }
                        return [4 /*yield*/, connection.createChannel()];
                    case 1:
                        channel = _b.sent();
                        channel.on('connect', function () {
                            logger.info('channel connected');
                        });
                        channel.on('error', function (err) {
                            logger.error(err);
                        });
                        channel.on('close', function () {
                            logger.info('local channel close');
                        });
                        if (!prefetch) return [3 /*break*/, 3];
                        return [4 /*yield*/, channel.prefetch(prefetch)];
                    case 2:
                        _b.sent();
                        _b.label = 3;
                    case 3: return [4 /*yield*/, channel.assertQueue((0, exports.getQueueFullName)(call.name, config.prefix, config.postfix), {
                            autoDelete: !persistent,
                            durable: persistent
                        }
                        // TODO. # Turn back
                        // {
                        //   ...rmqc.defaultAssertQueueOptions,
                        //   ...assertQueueOptions,
                        // }
                        )];
                    case 4:
                        q = _b.sent();
                        channel.consume(q.queue, function (msg) { return __awaiter(void 0, void 0, void 0, function () {
                            var asJson, requestParser, res, e_2, errorResponseData;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        if (!msg) return [3 /*break*/, 8];
                                        _a.label = 1;
                                    case 1:
                                        _a.trys.push([1, 6, 7, 8]);
                                        asJson = JSON.parse(msg.content.toString());
                                        requestParser = call.requestParser;
                                        if (requestParser) {
                                            requestParserValidate(requestParser, asJson.params);
                                        }
                                        if (reactiveCounter) {
                                            reactiveCounter.increment();
                                        }
                                        _a.label = 2;
                                    case 2:
                                        _a.trys.push([2, , 4, 5]);
                                        return [4 /*yield*/, handler(asJson, ctx(), depCalls)];
                                    case 3:
                                        res = _a.sent();
                                        channel.publish('', // Default exchange in RabbitMQ called ""
                                        msg.properties.replyTo, Buffer.from(JSON.stringify(res)), {
                                            correlationId: msg.properties.correlationId,
                                            contentType: 'application/json'
                                            // TODO. # Turn back
                                            //   ...rmqChannel.defaultPublishOptions,
                                        });
                                        return [3 /*break*/, 5];
                                    case 4:
                                        if (reactiveCounter) {
                                            reactiveCounter.decrement();
                                        }
                                        return [7 /*endfinally*/];
                                    case 5: return [3 /*break*/, 8];
                                    case 6:
                                        e_2 = _a.sent();
                                        errorResponseData = void 0;
                                        logger.error(e_2);
                                        if (e_2 instanceof categorized_errors_1.BaseError) {
                                            errorResponseData = {
                                                code: e_2.statusCode,
                                                message: e_2.message
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
                                        return [3 /*break*/, 8];
                                    case 7:
                                        channel.ack(msg);
                                        return [7 /*endfinally*/];
                                    case 8: return [2 /*return*/];
                                }
                            });
                        }); }
                        // TODO. # Turn back
                        // consumeOptions
                        );
                        return [4 /*yield*/, inmemoryTransport.subscribe(df, ctx)];
                    case 5:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); };
        var init = function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, initConnection(logger, config, onConnectCallback)];
                    case 1:
                        // Create connection
                        connection = _a.sent();
                        if (reconnect) {
                            connection.on('close', function () {
                                logger.warn('reconnecting');
                                // . Create new connection on close and repeat forever
                                return setTimeout(function () { return __awaiter(void 0, void 0, void 0, function () {
                                    return __generator(this, function (_a) {
                                        responseEmitter.removeAllListeners();
                                        init();
                                        return [2 /*return*/];
                                    });
                                }); }, 1000);
                            });
                        }
                        return [4 /*yield*/, connection.createChannel()];
                    case 2:
                        // # Create channel
                        globalChannel = _a.sent();
                        globalChannel.on('connect', function () {
                            logger.info('channel connected');
                        });
                        globalChannel.on('error', function (err) {
                            logger.error(err);
                        });
                        globalChannel.on('close', function () {
                            logger.info('global channel close');
                        });
                        // # Subscribe on reply queues
                        return [4 /*yield*/, globalChannel.consume(exports.REPLY_QUEUE, function (msg) {
                                if (msg) {
                                    responseEmitter.emit(msg.properties.correlationId, msg);
                                }
                            }, { noAck: true })];
                    case 3:
                        // # Subscribe on reply queues
                        _a.sent();
                        return [4 /*yield*/, Promise.all(subs.map(function (sub) {
                                subscribe(sub.df, sub.ctx);
                            }))];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, inmemoryTransport.init()];
                    case 5:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); };
        return {
            init: init,
            subscribe: subscribe,
            publish: publish,
            destroy: function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, connection.removeAllListeners().close()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, inmemoryTransport.destroy()];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); },
            checkDfExistence: function (dfCallName) { return __awaiter(void 0, void 0, void 0, function () {
                var channel, e_3;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, inmemoryTransport.checkDfExistence(dfCallName)];
                        case 1:
                            if (_a.sent()) {
                                return [2 /*return*/, true];
                            }
                            _a.label = 2;
                        case 2:
                            _a.trys.push([2, 5, , 6]);
                            return [4 /*yield*/, connection.createChannel()];
                        case 3:
                            channel = _a.sent();
                            return [4 /*yield*/, channel.checkQueue(dfCallName)];
                        case 4: return [2 /*return*/, !!(_a.sent())];
                        case 5:
                            e_3 = _a.sent();
                            if (e_3 instanceof Error) {
                                if (e_3.message.includes('404')) {
                                    return [2 /*return*/, false];
                                }
                            }
                            throw e_3;
                        case 6: return [2 /*return*/];
                    }
                });
            }); }
        };
    }
};
