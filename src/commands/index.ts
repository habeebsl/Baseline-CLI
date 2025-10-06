import { CommandMap } from '../types';
import { checkCommand } from './check';
import { initCommand } from './init';
import { configCommand } from './config';
import { fixCommand } from './fix';

const commands: CommandMap = {
    [checkCommand.name]: checkCommand,
    [initCommand.name]: initCommand,
    [configCommand.name]: configCommand,
    [fixCommand.name]: fixCommand,
};

export const executeCommand = async (commandName: string, args: string[] = []): Promise<void> => {
    const command = commands[commandName];
    if (!command) {
        console.error(`Command '${commandName}' not found`);
        console.error('Available commands: check, init, config, fix');
        return;
    }
    await command.execute(args);
};

export { checkCommand, initCommand, configCommand, fixCommand };