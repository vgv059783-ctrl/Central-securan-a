const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, REST, Routes } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

const globalCommands = [];
const privateCommands = [];
const CENTRAL_GUILD_ID = '1479645437097934881'; // Substitua pelo ID correto se houver erro de digitação

// Carregamento de comandos
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
                
                // Se o comando tiver a propriedade "adminOnly", vai para a lista privada
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

client.once('ready', async (c) => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    try {
        // Registra comandos GLOBAIS (aparecem em todos os servidores)
        await rest.put(Routes.applicationCommands(c.user.id), { body: globalCommands });

        // Registra comandos PRIVADOS (apenas no seu servidor central)
        await rest.put(Routes.applicationGuildCommands(c.user.id, CENTRAL_GUILD_ID), { body: privateCommands });

        console.log(`✅ ${c.user.tag} online. Comandos globais e privados registrados!`);
    } catch (error) {
        console.error('❌ Erro no registro:', error);
    }
});

// Listener de interação (mesmo código anterior...)
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try { await command.execute(interaction); } catch (e) { console.error(e); }
});

client.login(process.env.DISCORD_TOKEN);
