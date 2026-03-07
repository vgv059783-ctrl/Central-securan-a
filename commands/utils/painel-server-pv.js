const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('painel-server-pv')
        .setDescription('Configura o sistema de acesso privado do servidor')
        .addChannelOption(opt => opt.setName('canal_painel').setDescription('Canal público de verificação').setRequired(true))
        .addChannelOption(opt => opt.setName('canal_chaves').setDescription('Canal de logs de chaves').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const painelChan = interaction.options.getChannel('canal_painel');
        const chavesChan = interaction.options.getChannel('canal_chaves');
        const guild = interaction.guild;

        let role = guild.roles.cache.find(r => r.name === 'Confirmado') || await guild.roles.create({ name: 'Confirmado' });

        const config = fs.existsSync('/app/data/privado.json') ? JSON.parse(fs.readFileSync('/app/data/privado.json')) : {};
        config[guild.id] = { canalChaves: chavesChan.id, roleId: role.id, canalPainelId: painelChan.id };
        fs.writeFileSync('/app/data/privado.json', JSON.stringify(config, null, 2));

        guild.channels.cache.forEach(async (ch) => {
            try {
                if (ch.id === painelChan.id) {
                    await ch.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: true, SendMessages: false });
                    await ch.permissionOverwrites.edit(role, { ViewChannel: false });
                } else {
                    await ch.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false });
                    await ch.permissionOverwrites.edit(role, { ViewChannel: true });
                }
            } catch (e) {}
        });

        const embed = new EmbedBuilder()
            .setTitle('🔐 Verificação de Acesso')
            .setDescription('Clique abaixo para gerar sua chave única e liberar o servidor.')
            .setColor('#2b2d31');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('gerar_chave').setLabel('Gerar Chave').setStyle(ButtonStyle.Primary)
        );

        await painelChan.send({ embeds: [embed], components: [row] });
        await interaction.editReply('✅ Sistema configurado!');
    }
};
