const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, REST, Routes } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();
const commandsArray = [];

// 1. Carregamento Automático de Comandos
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
                commandsArray.push(command.data.toJSON()); // Prepara para o registro
            }
        }
    }
};

loadCommands(path.join(__dirname, 'commands'));

// 2. Registro Automático (Deploy) ao Iniciar
client.once('ready', async (c) => {
    console.log(`✅ Logado como ${c.user.tag}`);
    
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('⏳ Registrando comandos slash...');
        await rest.put(
            Routes.applicationCommands(c.user.id),
            { body: commandsArray },
        );
        console.log('🚀 Comandos registrados globalmente!');
    } catch (error) {
        console.error('❌ Erro ao registrar comandos:', error);
    }
});

// 3. Execução de Comandos
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Erro no comando!', ephemeral: true });
    }
});

client.login(process.env.DISCORD_TOKEN);
