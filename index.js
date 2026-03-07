const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, REST, Routes, PermissionFlagsBits } = require('discord.js');

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
const globalCommands = [];
const privateCommands = [];
const CENTRAL_GUILD_ID = '1479645437097934881';
const DB_PATH = '/app/data/antiraid.json';

// Caches de monitoramento
const channelCreateCache = new Map();
const messageCache = new Map();
const joinCache = new Map();

// Carregamento Automático de Comandos
const loadCommands = (dir) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.lstatSync(filePath).isDirectory()) {
            loadCommands(filePath);
        } else if (file.endsWith('.js')) {
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                if (command.adminOnly) {
                    privateCommands.push(command.data.toJSON());
                } else {
                    globalCommands.push(command.data.toJSON());
                }
            }
        }
    }
};
loadCommands(path.join(__dirname, 'commands'));

// Inicialização e Registro de Comandos
client.once('ready', async (c) => {
    console.log(`✅ ${c.user.tag} online!`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(c.user.id), { body: globalCommands });
        await rest.put(Routes.applicationGuildCommands(c.user.id, CENTRAL_GUILD_ID), { body: privateCommands });
        console.log('🚀 Comandos sincronizados.');
    } catch (e) { console.error('Erro Registro:', e); }
});

// Anti-Spam (+10 msgs / 3s)
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    const authorId = message.author.id;
    const now = Date.now();
    if (!messageCache.has(authorId)) messageCache.set(authorId, []);
    const userMsgs = messageCache.get(authorId);
    userMsgs.push(now);
    const recent = userMsgs.filter(t => now - t < 3000);
    messageCache.set(authorId, recent);
    if (recent.length >= 10 && message.member?.manageable) {
        await message.member.timeout(86400000, 'Anti-Spam').catch(() => null);
        await message.channel.send(`🚨 ${message.author} castigado por spam.`);
    }
});

// Anti-Canal (+7 canais / 3s)
client.on('channelCreate', async (channel) => {
    const audit = await channel.guild.fetchAuditLogs({ limit: 1, type: 10 }).catch(() => null);
    const entry = audit?.entries.first();
    if (!entry) return;
    const execId = entry.executor.id;
    const now = Date.now();
    if (!channelCreateCache.has(execId)) channelCreateCache.set(execId, []);
    const actions = channelCreateCache.get(execId);
    actions.push(now);
    const recent = actions.filter(t => now - t < 3000);
    channelCreateCache.set(execId, recent);
    if (recent.length >= 7) {
        const member = await channel.guild.members.fetch(execId).catch(() => null);
        if (member?.manageable) await member.timeout(86400000, 'Anti-Raid Canais').catch(() => null);
    }
});

// Anti-Raid Join (+5 pessoas / 10s)
client.on('guildMemberAdd', async (member) => {
    if (!fs.existsSync(DB_PATH)) return;
    const config = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    if (!config[member.guild.id]?.enabled) return;
    const gid = member.guild.id;
    const now = Date.now();
    if (!joinCache.has(gid)) joinCache.set(gid, []);
    const recent = joinCache.get(gid).filter(t => now - t < 10000);
    recent.push(now);
    joinCache.set(gid, recent);
    if (recent.length > 5 && member.manageable) {
        await member.timeout(86400000, 'Anti-Raid Join').catch(() => null);
    }
});

// Handler de Comandos
client.on('interactionCreate', async (int) => {
    if (!int.isChatInputCommand()) return;
    const cmd = client.commands.get(int.commandName);
    if (cmd) await cmd.execute(int).catch(e => console.error(e));
});

// Anti-Crash
process.on('unhandledRejection', e => console.error('Erro Crítico:', e));
process.on('uncaughtException', e => console.error('Exceção:', e));

client.login(process.env.DISCORD_TOKEN);
