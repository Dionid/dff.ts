"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.App = exports.Trigger = exports.CallHandler = exports.Call = void 0;
var uuid_1 = require("uuid");
var transport_inmemory_1 = require("../transport-inmemory");
var Call = function (name, requestParser // TODO. Create from ReqParams
) {
    return {
        name: name,
        requestParser: requestParser,
        request: function (params, id) {
            return {
                id: id || (0, uuid_1.v4)(),
                name: name,
                params: params
            };
        },
        result: function (props) {
            var result = props.result;
            if ('req' in props) {
                return {
                    id: props.req.id,
                    result: result
                };
            }
            else {
                return {
                    id: props.id,
                    result: result
                };
            }
        },
        error: function (props) {
            var error = props.error;
            if ('req' in props) {
                return {
                    id: props.req.id,
                    error: error
                };
            }
            else {
                return {
                    id: props.id,
                    error: error
                };
            }
        }
    };
};
exports.Call = Call;
var CallHandler = function (props) {
    var reactiveCounter = props.reactiveCounter;
    return __assign(__assign({}, props), { persistent: props.persistent === undefined ? false : props.persistent, handler: reactiveCounter
            ? function (req, ctx, depCalls) { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    reactiveCounter.increment();
                    try {
                        return [2 /*return*/, props.handler(req, ctx, depCalls)];
                    }
                    finally {
                        reactiveCounter.decrement();
                    }
                    return [2 /*return*/];
                });
            }); }
            : props.handler });
};
exports.CallHandler = CallHandler;
var Trigger = function (props) {
    return props;
};
exports.Trigger = Trigger;
var App = function (props) {
    var name = props.name, dfs = props.dfs, triggers = props.triggers, discovery = props.discovery, ctx = props.ctx;
    var logger = props.logger || {
        info: console.log,
        error: console.error,
        warn: console.warn
    };
    var _a = props.transport, transport = _a === void 0 ? transport_inmemory_1.InmemoryTransport["new"]({ logger: logger }) : _a;
    var depsCallHandlers = {};
    return {
        name: name,
        start: function () { return __awaiter(void 0, void 0, void 0, function () {
            var _loop_1, _i, _a, callName;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: 
                    // # Init transport
                    return [4 /*yield*/, transport.init()
                        // # Subscribe dfs
                    ];
                    case 1:
                        // # Init transport
                        _b.sent();
                        // # Subscribe dfs
                        return [4 /*yield*/, Promise.all(dfs.map(function (df) { return __awaiter(void 0, void 0, void 0, function () {
                                var depCalls;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            depCalls = df.depCalls;
                                            // # Map throw Dep Calls to register dependencies
                                            depsCallHandlers[df.call.name] = [];
                                            if (depCalls) {
                                                Object.values(depCalls).map(function (depCallRaw) {
                                                    var depCall = depCallRaw;
                                                    depsCallHandlers[df.call.name].push(depCall.name);
                                                });
                                            }
                                            // # Sub call on transaport
                                            return [4 /*yield*/, transport.subscribe(df, ctx)];
                                        case 1:
                                            // # Sub call on transaport
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); }))
                            // # Init triggers
                        ];
                    case 2:
                        // # Subscribe dfs
                        _b.sent();
                        // # Init triggers
                        return [4 /*yield*/, Promise.all((triggers === null || triggers === void 0 ? void 0 : triggers.map(function (tr) { return __awaiter(void 0, void 0, void 0, function () {
                                var depCalls, _a, triggerName, depCallsAsFn, _i, _b, key;
                                return __generator(this, function (_c) {
                                    switch (_c.label) {
                                        case 0:
                                            depCalls = tr.depCalls, _a = tr.name, triggerName = _a === void 0 ? 'Trigger' : _a;
                                            // # Map throw Dep Calls to register dependencies
                                            if (depCalls) {
                                                Object.values(depCalls).map(function (depCall) {
                                                    if (depsCallHandlers[triggerName]) {
                                                        depsCallHandlers[triggerName].push(depCall.name);
                                                    }
                                                    else {
                                                        depsCallHandlers[triggerName] = [depCall.name];
                                                    }
                                                });
                                            }
                                            else {
                                                depsCallHandlers[name] = [];
                                            }
                                            depCallsAsFn = {};
                                            for (_i = 0, _b = Object.keys(depCalls); _i < _b.length; _i++) {
                                                key = _b[_i];
                                                // # Publish dep call and return result
                                                // @ts-ignore
                                                depCallsAsFn[key] = function (request) { return __awaiter(void 0, void 0, void 0, function () {
                                                    return __generator(this, function (_a) {
                                                        return [2 /*return*/, transport.publish(request)];
                                                    });
                                                }); };
                                            }
                                            return [4 /*yield*/, tr.init(depCallsAsFn)];
                                        case 1:
                                            _c.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })) || [])
                            // # Check all deps
                        ];
                    case 3:
                        // # Init triggers
                        _b.sent();
                        _loop_1 = function (callName) {
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0: return [4 /*yield*/, Promise.all(depsCallHandlers[callName].map(function (depName) { return __awaiter(void 0, void 0, void 0, function () {
                                            var exist;
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0:
                                                        if (!depsCallHandlers[depName]) return [3 /*break*/, 1];
                                                        logger.info("CallHandler ".concat(callName, " is dependednt on ").concat(depName, " tart IS presented localy"));
                                                        return [3 /*break*/, 3];
                                                    case 1:
                                                        if (!!discovery) return [3 /*break*/, 3];
                                                        return [4 /*yield*/, transport.checkDfExistence(depName)];
                                                    case 2:
                                                        exist = _a.sent();
                                                        if (exist === true) {
                                                            console.warn("CallHandler ".concat(callName, " is dependednt on ").concat(depName, " that IS presented in transport"));
                                                        }
                                                        else if (exist === false) {
                                                            console.warn("CallHandler ".concat(callName, " is dependednt on ").concat(depName, " that IS NOT presented in transport"));
                                                        }
                                                        else {
                                                            console.warn("CallHandler ".concat(callName, " is dependednt on ").concat(depName, " that CAN'T be dicovered"));
                                                        }
                                                        _a.label = 3;
                                                    case 3: return [2 /*return*/];
                                                }
                                            });
                                        }); }))];
                                    case 1:
                                        _c.sent();
                                        return [2 /*return*/];
                                }
                            });
                        };
                        _i = 0, _a = Object.keys(depsCallHandlers);
                        _b.label = 4;
                    case 4:
                        if (!(_i < _a.length)) return [3 /*break*/, 7];
                        callName = _a[_i];
                        return [5 /*yield**/, _loop_1(callName)];
                    case 5:
                        _b.sent();
                        _b.label = 6;
                    case 6:
                        _i++;
                        return [3 /*break*/, 4];
                    case 7:
                        logger.info("App ".concat(name, " has started!"));
                        return [2 /*return*/];
                }
            });
        }); },
        destroy: function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!triggers) return [3 /*break*/, 2];
                        return [4 /*yield*/, Promise.all(triggers.map(function (tr) { return tr.destroy(); }))];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [4 /*yield*/, transport.destroy()];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); }
    };
};
exports.App = App;
