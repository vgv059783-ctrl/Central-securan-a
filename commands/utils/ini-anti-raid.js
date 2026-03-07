const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Caminho do volume no Railway
const dbPath = '/app/data/antiraid.json';

module.exports = {
    // Removido o adminOnly para aparecer em todos os servers
    data: new SlashCommandBuilder()
        .setName('ini-anti-raid')
        .setDescription('Configura a proteção contra entradas em massa neste servidor')
        .addStringOption(opt => opt.setName('status').setDescription('Ligar ou Desligar').addChoices(
            { name: 'Ligar', value: 'on' },
            { name: 'Desligar', value: 'off' }
        ).setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Apenas ADMs do server podem usar
    async execute(interaction) {
        let config = {};

        // Tenta ler o arquivo se ele existir
        if (fs.existsSync(dbPath)) {
            try {
                config = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
            } catch (e) {
                console.error("Erro ao ler DB:", e);
            }
        }

        // Salva a config específica deste servidor
        const status = interaction.options.getString('status');
        config[interaction.guildId] = { enabled: status === 'on' };

        // Grava no volume /app/data
        try {
            fs.writeFileSync(dbPath, JSON.stringify(config, null, 2));
            await interaction.reply({ 
                content: `🛡️ O sistema Anti-Raid foi **${status === 'on' ? 'ATIVADO' : 'DESATIVADO'}** neste servidor!`, 
                ephemeral: true 
            });
        } catch (e) {
            console.error("Erro ao salvar DB:", e);
            await interaction.reply({ content: 'Erro ao salvar configuração no volume.', ephemeral: true });
        }
    }
};
