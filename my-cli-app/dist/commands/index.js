"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configCommand = exports.initCommand = exports.checkCommand = exports.executeCommand = void 0;
const check_1 = require("./check");
Object.defineProperty(exports, "checkCommand", { enumerable: true, get: function () { return check_1.checkCommand; } });
const init_1 = require("./init");
Object.defineProperty(exports, "initCommand", { enumerable: true, get: function () { return init_1.initCommand; } });
const config_1 = require("./config");
Object.defineProperty(exports, "configCommand", { enumerable: true, get: function () { return config_1.configCommand; } });
const commands = {
    [check_1.checkCommand.name]: check_1.checkCommand,
    [init_1.initCommand.name]: init_1.initCommand,
    [config_1.configCommand.name]: config_1.configCommand,
};
const executeCommand = async (commandName, args = []) => {
    const command = commands[commandName];
    if (!command) {
        console.error(`Command '${commandName}' not found`);
        console.error('Available commands: check, init, config');
        return;
    }
    await command.execute(args);
};
exports.executeCommand = executeCommand;
