const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, REST, Routes } = require('discord.js');
const protecao = require('./protecao.js'); // Importa a lógica

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildModeration
    ] 
});

client.commands = new Collection();
const globalCmds = [], privateCmds = [];
const CENTRAL_GUILD = '1479645437097934881';

// Handler de Comandos Automático
const load = (dir) => {
    const files = fs.readdirSync(dir);
    for (const f of files) {
        const fp = path.join(dir, f);
        if (fs.lstatSync(fp).isDirectory()) load(fp);
        else if (f.endsWith('.js')) {
            const cmd = require(fp);
            client.commands.set(cmd.data.name, cmd);
            cmd.adminOnly ? privateCmds.push(cmd.data.toJSON()) : globalCmds.push(cmd.data.toJSON());
        }
    }
};
load(path.join(__dirname, 'commands'));

client.once('ready', async (c) => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(c.user.id), { body: globalCmds });
    await rest.put(Routes.applicationGuildCommands(c.user.id, CENTRAL_GUILD), { body: privateCmds });
    console.log(`✅ ${c.user.tag} online!`);
});

// Eventos repassando para protecao.js
client.on('messageCreate', m => protecao.verificarSpam(m));
client.on('channelCreate', ch => protecao.verificarCriacaoCanal(ch));
client.on('channelDelete', ch => protecao.verificarExclusaoCanal(ch));
client.on('guildMemberAdd', mem => protecao.verificarRaidJoin(mem));

client.on('interactionCreate', async i => {
    if (!i.isChatInputCommand()) return;
    const cmd = client.commands.get(i.commandName);
    if (cmd) await cmd.execute(i).catch(() => null);
});

client.login(process.env.DISCORD_TOKEN);
