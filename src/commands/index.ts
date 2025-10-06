import { CommandMap } from '../types';
import { checkCommand } from './check';
import { initCommand } from './init';
import { configCommand } from './config';

const commands: CommandMap = {
    [checkCommand.name]: checkCommand,
    [initCommand.name]: initCommand,
    [configCommand.name]: configCommand,
};

export const executeCommand = async (commandName: string, args: string[] = []): Promise<void> => {
    const command = commands[commandName];
    if (!command) {
        console.error(`Command '${commandName}' not found`);
        console.error('Available commands: check, init, config');
        return;
    }
    await command.execute(args);
};

export { checkCommand, initCommand, configCommand };