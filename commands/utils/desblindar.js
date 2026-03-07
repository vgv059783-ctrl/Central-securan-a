const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('node:fs');
const B_PATH = '/app/data/blindagem.json';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('desblindar')
        .setDescription('Remove a blindagem dos canais')
        .addStringOption(opt => opt.setName('alvo').setDescription('O que desblindar?').addChoices(
            { name: 'Todos os canais', value: 'todos' },
            { name: 'Apenas este canal', value: 'este' }
        ).setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        if (!fs.existsSync(B_PATH)) {
            return interaction.reply({ content: '❌ Não há canais blindados neste servidor.', ephemeral: true });
        }

        let db = JSON.parse(fs.readFileSync(B_PATH, 'utf8'));
        const alvo = interaction.options.getString('alvo');
        const guildId = interaction.guildId;

        if (!db[guildId]) {
            return interaction.reply({ content: '❌ Não há dados de blindagem para este servidor.', ephemeral: true });
        }

        if (alvo === 'todos') {
            delete db[guildId];
            await interaction.reply({ content: '🔓 **Blindagem removida** de todos os canais do servidor.', ephemeral: true });
        } else {
            if (db[guildId][interaction.channelId]) {
                delete db[guildId][interaction.channelId];
                await interaction.reply({ content: '🔓 **Blindagem removida** deste canal.', ephemeral: true });
            } else {
                return interaction.reply({ content: '❌ Este canal não estava blindado.', ephemeral: true });
            }
        }

        fs.writeFileSync(B_PATH, JSON.stringify(db, null, 2));
    }
};
