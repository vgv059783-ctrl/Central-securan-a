const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, REST, Routes } = require('discord.js');
const protecao = require('./protecao.js'); // Importa a lógica separada

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

// --- 1. HANDLER DE COMANDOS AUTOMÁTICO ---
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
                    privateCmds.push(command.data.toJSON());
                } else {
                    globalCmds.push(command.data.toJSON());
                }
            }
        }
    }
};
loadCommands(path.join(__dirname, 'commands'));

// --- 2. INICIALIZAÇÃO E REGISTRO ---
client.once('ready', async (c) => {
    console.log(`✅ ${c.user.tag} online no Railway!`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        // Comandos para todos os servidores
        await rest.put(Routes.applicationCommands(c.user.id), { body: globalCmds });
        // Comandos exclusivos do seu servidor central
        await rest.put(Routes.applicationGuildCommands(c.user.id, CENTRAL_GUILD_ID), { body: privateCmds });
        console.log('🚀 Comandos sincronizados globalmente e no servidor central.');
    } catch (error) {
        console.error('❌ Erro ao registrar comandos:', error);
    }
});

// --- 3. REPASSE DE EVENTOS PARA LÓGICA.JS (PROTECAO.JS) ---
client.on('messageCreate', (m) => protecao.verificarSpam(m));
client.on('channelCreate', (ch) => protecao.verificarCriacaoCanal(ch));
client.on('channelDelete', (ch) => protecao.verificarExclusaoCanal(ch));
client.on('guildMemberAdd', (mem) => protecao.verificarRaidJoin(mem));

// --- 4. HANDLER DE INTERAÇÕES (COMANDOS, BOTÕES E MODAIS) ---
client.on('interactionCreate', async (interaction) => {
    // Comandos Slash
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (command) {
            await command.execute(interaction).catch(err => {
                console.error(err);
                if (!interaction.replied) interaction.reply({ content: 'Erro ao executar!', ephemeral: true });
            });
        }
    } 
    // Sistema de Verificação (Botões e Modais)
    else if (interaction.isButton() || interaction.isModalSubmit()) {
        await protecao.lidarVerificacao(interaction);
    }
});

// --- 5. SISTEMA ANTI-CRASH ---
process.on('unhandledRejection', (reason) => console.error('🚨 Erro não tratado:', reason));
process.on('uncaughtException', (err) => console.error('🚨 Exceção crítica:', err));

client.login(process.env.DISCORD_TOKEN);
