"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReplyTimeoutError = void 0;
class ReplyTimeoutError extends Error {
    constructor(correlationId, data) {
        super(`Timeout for ${correlationId} with ${data}`);
    }
}
exports.ReplyTimeoutError = ReplyTimeoutError;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXJyb3JzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2Vycm9ycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFFQSxNQUFhLGlCQUFrQixTQUFRLEtBQUs7SUFDMUMsWUFBWSxhQUFxQixFQUFFLElBQWU7UUFDaEQsS0FBSyxDQUFDLGVBQWUsYUFBYSxTQUFTLElBQUksRUFBRSxDQUFDLENBQUE7SUFDcEQsQ0FBQztDQUNGO0FBSkQsOENBSUMifQ==