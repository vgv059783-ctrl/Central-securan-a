const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('node:fs');
const DB_PATH = '/app/data/antiraid.json';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ini-anti-raid')
        .setDescription('Configura o sistema anti-raid e logs')
        .addStringOption(opt => opt.setName('status').setDescription('Ligar/Desligar').addChoices({name:'Ligar',value:'on'},{name:'Desligar',value:'off'}).setRequired(true))
        .addChannelOption(opt => opt.setName('logs').setDescription('Canal de avisos do bot').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        let config = fs.existsSync(DB_PATH) ? JSON.parse(fs.readFileSync(DB_PATH)) : {};
        const status = interaction.options.getString('status');
        const logChannel = interaction.options.getChannel('logs');

        config[interaction.guildId] = { 
            enabled: status === 'on', 
            logChannelId: logChannel.id 
        };

        fs.writeFileSync(DB_PATH, JSON.stringify(config, null, 2));
        await interaction.reply({ content: `🛡️ Anti-Raid ${status === 'on' ? 'ON' : 'OFF'}. Logs em: <#${logChannel.id}>`, ephemeral: true });
    }
};
