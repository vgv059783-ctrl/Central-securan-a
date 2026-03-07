const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, REST, Routes, PermissionFlagsBits } = require('discord.js');

// Configuração do Cliente com todos os Intents necessários
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

// Caches para monitoramento em tempo real
const channelCreateCache = new Map();
const messageCache = new Map();

// --- 1. CARREGAMENTO DE COMANDOS ---
const loadCommands = (dir) => {
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

// --- 2. REGISTRO E INICIALIZAÇÃO ---
client.once('ready', async (c) => {
    console.log(`✅ Logado como ${c.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(c.user.id), { body: globalCommands });
        await rest.put(Routes.applicationGuildCommands(c.user.id, CENTRAL_GUILD_ID), { body: privateCommands });
        console.log('🚀 Comandos registrados (Global e Privado)!');
    } catch (error) {
        console.error('❌ Erro no registro:', error);
    }
});

// --- 3. SISTEMA ANTI-SPAM (+10 mgs em 3s -> 24h timeout) ---
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const authorId = message.author.id;
    const now = Date.now();

    if (!messageCache.has(authorId)) messageCache.set(authorId, []);
    const userMessages = messageCache.get(authorId);
    userMessages.push(now);

    const recentMessages = userMessages.filter(time => now - time < 3000);
    messageCache.set(authorId, recentMessages);

    if (recentMessages.length >= 10) {
        try {
            if (message.member.manageable) {
                await message.member.timeout(24 * 60 * 60 * 1000, 'Anti-Spam: +10 msgs em 3s');
                await message.channel.send(`🚨 ${message.author} castigado por 24h (Spam).`);
            }
        } catch (e) { console.error('Erro Timeout Spam:', e); }
    }
});

// --- 4. SISTEMA ANTI-CANAL (+7 canais em 3s -> 24h timeout) ---
client.on('channelCreate', async (channel) => {
    const guild = channel.guild;
    const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: 10 }).catch(() => null);
    const entry = auditLogs?.entries.first();
    if (!entry) return;

    const executorId = entry.executor.id;
    const now = Date.now();

    if (!channelCreateCache.has(executorId)) channelCreateCache.set(executorId, []);
    const actions = channelCreateCache.get(executorId);
    actions.push(now);

    const recentActions = actions.filter(time => now - time < 3000);
    channelCreateCache.set(executorId, recentActions);

    if (recentActions.length >= 7) {
        try {
            const member = await guild.members.fetch(executorId);
            if (member.manageable) {
                await member.timeout(24 * 60 * 60 * 1000, 'Anti-Raid: Criação massiva de canais');
            }
        } catch (e) { console.error('Erro Timeout Canais:', e); }
    }
});

// --- 5. EXECUÇÃO DE COMANDOS ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Erro ao executar comando!', ephemeral: true });
    }
});

client.login(process.env.DISCORD_TOKEN);
