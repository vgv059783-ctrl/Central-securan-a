const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('painel-server-pv')
        .setDescription('Configura o sistema de acesso privado do servidor')
        .addChannelOption(opt => opt.setName('canal_painel').setDescription('Onde o botão de acesso ficará').setRequired(true))
        .addChannelOption(opt => opt.setName('canal_chaves').setDescription('Onde as chaves serão logadas').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const painelChan = interaction.options.getChannel('canal_painel');
        const chavesChan = interaction.options.getChannel('canal_chaves');
        const guild = interaction.guild;

        // 1. Criar ou achar cargo "Confirmado"
        let role = guild.roles.cache.find(r => r.name === 'Confirmado');
        if (!role) {
            role = await guild.roles.create({ name: 'Confirmado', reason: 'Sistema de Acesso PV' });
        }

        // 2. Salvar configs no volume
        const cfgPath = '/app/data/privado.json';
        const config = fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath)) : {};
        config[guild.id] = { canalChaves: chavesChan.id, roleId: role.id };
        fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2));

        // 3. Privar canais (menos o do painel)
        guild.channels.cache.forEach(async (ch) => {
            if (ch.id === painelChan.id) return;
            try {
                await ch.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false });
                await ch.permissionOverwrites.edit(role, { ViewChannel: true });
            } catch (e) { console.error(`Erro no canal ${ch.name}`); }
        });

        // 4. Enviar Painel
        const embed = new EmbedBuilder()
            .setTitle('🔐 Verificação de Acesso')
            .setDescription('Clique no botão abaixo para gerar sua chave de acesso e liberar o servidor.')
            .setColor('#2b2d31');

        const btn = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('gerar_chave').setLabel('Gerar Chave').setStyle(ButtonStyle.Primary)
        );

        await painelChan.send({ embeds: [embed], components: [btn] });
        await interaction.editReply('✅ Sistema configurado e canais privados!');
    }
};
