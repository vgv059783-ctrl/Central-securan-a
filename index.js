const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, REST, Routes } = require('discord.js');
const protecao = require('./protecao.js');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildModeration
    ] 
});

client.commands = new Collection();
const globalCmds = [];
const privateCmds = [];
const CENTRAL_GUILD_ID = '1479645437097934881';

const loadCommands = (dir) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.lstatSync(filePath).isDirectory()) loadCommands(filePath);
        else if (file.endsWith('.js')) {
            const command = require(filePath);
            if (command.data && command.execute) {
                client.commands.set(command.data.name, command);
                command.adminOnly ? privateCmds.push(command.data.toJSON()) : globalCmds.push(command.data.toJSON());
            }
        }
    }
};
loadCommands(path.join(__dirname, 'commands'));

client.once('ready', async (c) => {
    console.log(`✅ ${c.user.tag} rodando.`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(c.user.id), { body: globalCmds });
        await rest.put(Routes.applicationGuildCommands(c.user.id, CENTRAL_GUILD_ID), { body: privateCmds });
    } catch (e) { console.error(e); }
});

client.on('messageCreate', m => protecao.verificarSpam(m));
client.on('channelCreate', ch => protecao.verificarCriacaoCanal(ch));
client.on('channelDelete', ch => protecao.verificarExclusaoCanal(ch));
client.on('guildMemberAdd', mem => protecao.verificarRaidJoin(mem));}

client.on('interactionCreate', async (i) => {
    if (i.isChatInputCommand()) {
        const cmd = client.commands.get(i.commandName);
        if (cmd) await cmd.execute(i).catch(() => null);
    } else if (i.isButton() || i.isModalSubmit()) {
        await protecao.lidarVerificacao(i);
    }
});

process.on('unhandledRejection', e => console.error(e));
process.on('uncaughtException', e => console.error(e));

client.login(process.env.DISCORD_TOKEN);
