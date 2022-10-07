"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpTrigger = void 0;
const core_1 = require("@distributed-functions/core");
const fastify_1 = __importDefault(require("fastify"));
const uuid_1 = require("uuid");
exports.HttpTrigger = {
    new: (props) => {
        const { calls, config = {} } = props;
        const { port = 3000, path = '/call' } = config;
        const depCalls = calls.reduce((acc, cur) => {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            acc[cur.name] = cur;
            return acc;
        }, {});
        const http = (0, fastify_1.default)({
            logger: true,
            genReqId: () => (0, uuid_1.v4)()
        });
        return (0, core_1.Trigger)({
            depCalls,
            destroy: async () => {
                await http.close();
            },
            init: async (initDepCalls) => {
                http.post(path, async (req, res) => {
                    const call = initDepCalls[req.body.name];
                    if (call) {
                        const response = await call(req.body);
                        res.send(response);
                    }
                    else {
                        res.status(404).send({
                            id: req.body.id,
                            error: {
                                code: 404,
                                message: "Haven't found call"
                            }
                        });
                    }
                });
                await http.listen({ port });
            }
        });
    }
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsc0RBQXdFO0FBQ3hFLHNEQUFpRDtBQUNqRCwrQkFBeUI7QUFFWixRQUFBLFdBQVcsR0FBRztJQUN6QixHQUFHLEVBQUUsQ0FBd0QsS0FNNUQsRUFBaUIsRUFBRTtRQUNsQixNQUFNLEVBQUUsS0FBSyxFQUFFLE1BQU0sR0FBRyxFQUFFLEVBQUUsR0FBRyxLQUFLLENBQUE7UUFFcEMsTUFBTSxFQUFFLElBQUksR0FBRyxJQUFJLEVBQUUsSUFBSSxHQUFHLE9BQU8sRUFBRSxHQUFHLE1BQU0sQ0FBQTtRQUU5QyxNQUFNLFFBQVEsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFO1lBQ3pDLDZEQUE2RDtZQUM3RCxhQUFhO1lBQ2IsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxHQUFHLENBQUE7WUFFbkIsT0FBTyxHQUFHLENBQUE7UUFDWixDQUFDLEVBQUUsRUFBVSxDQUFDLENBQUE7UUFFZCxNQUFNLElBQUksR0FBRyxJQUFBLGlCQUFPLEVBQUM7WUFDbkIsTUFBTSxFQUFFLElBQUk7WUFDWixRQUFRLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBQSxTQUFFLEdBQUU7U0FDckIsQ0FBQyxDQUFBO1FBRUYsT0FBTyxJQUFBLGNBQU8sRUFBQztZQUNiLFFBQVE7WUFDUixPQUFPLEVBQUUsS0FBSyxJQUFJLEVBQUU7Z0JBQ2xCLE1BQU0sSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFBO1lBQ3BCLENBQUM7WUFDRCxJQUFJLEVBQUUsS0FBSyxFQUFFLFlBQVksRUFBRSxFQUFFO2dCQUMzQixJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsR0FBMEMsRUFBRSxHQUFHLEVBQUUsRUFBRTtvQkFDeEUsTUFBTSxJQUFJLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUE7b0JBRXhDLElBQUksSUFBSSxFQUFFO3dCQUNSLE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUEyQyxDQUFDLENBQUE7d0JBRTVFLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUE7cUJBQ25CO3lCQUFNO3dCQUNMLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDOzRCQUNuQixFQUFFLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFOzRCQUNmLEtBQUssRUFBRTtnQ0FDTCxJQUFJLEVBQUUsR0FBRztnQ0FDVCxPQUFPLEVBQUUsb0JBQW9COzZCQUM5Qjt5QkFDRixDQUFDLENBQUE7cUJBQ0g7Z0JBQ0gsQ0FBQyxDQUFDLENBQUE7Z0JBRUYsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQTtZQUM3QixDQUFDO1NBQ0YsQ0FBQyxDQUFBO0lBQ0osQ0FBQztDQUNGLENBQUEifQ==