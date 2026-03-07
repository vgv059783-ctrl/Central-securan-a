const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    adminOnly: true, // Isso faz ele ser filtrado pelo index.js
    data: new SlashCommandBuilder()
        .setName('ban-serve')
        .setDescription('Comando restrito ao servidor central')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        await interaction.reply('Executando ação administrativa...');
    },
};
