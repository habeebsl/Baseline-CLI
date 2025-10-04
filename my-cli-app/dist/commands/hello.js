"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.helloCommand = void 0;
const utils_1 = require("../utils");
exports.helloCommand = {
    name: 'hello',
    description: 'Say hello to someone',
    async execute(args) {
        const name = args[0] || 'World';
        if (!(0, utils_1.validateInput)(name)) {
            console.error('Invalid input provided');
            return;
        }
        console.log((0, utils_1.formatOutput)(`Hello, ${name}!`));
    }
};
