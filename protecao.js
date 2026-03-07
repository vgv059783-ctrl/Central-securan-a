const fs = require('node:fs');
const crypto = require('crypto');
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');

const RAID_DB = '/app/data/antiraid.json';
const BLIND_DB = '/app/data/blindagem.json';
const PRIVADO_DB = '/app/data/privado.json';
const KEYS_DB = '/app/data/keys.json';

const caches = { msg: new Map(), ch: new Map(), join: new Map() };

const sendLog = (guild, text) => {
    if (!fs.existsSync(RAID_DB)) return;
    const config = JSON.parse(fs.readFileSync(RAID_DB, 'utf8'));
    const logId = config[guild.id]?.logChannelId;
    if (logId) {
        const chan = guild.channels.cache.get(logId);
        chan?.send(text).catch(() => null);
    }
};

module.exports = {
    // ... (Mantenha verificarSpam, verificarCriacaoCanal, verificarExclusaoCanal, verificarRaidJoin como no código anterior)

    async lidarVerificacao(interaction) {
        if (!fs.existsSync(PRIVADO_DB)) return;
        const config = JSON.parse(fs.readFileSync(PRIVADO_DB, 'utf8'));
        const cfg = config[interaction.guildId];
        if (!cfg) return;

        const keys = fs.existsSync(KEYS_DB) ? JSON.parse(fs.readFileSync(KEYS_DB)) : {};

        // --- BOTÃO: GERAR CHAVE ---
        if (interaction.customId === 'gerar_chave') {
            // Verifica se o usuário já tem uma chave pendente
            if (keys[interaction.user.id]) {
                return interaction.reply({ content: '⚠️ Você já possui uma chave pendente! Verifique seu tópico de acesso ou use a chave atual.', ephemeral: true });
            }

            // Gerar a chave (padrão solicitado)
            const ultimosDois = interaction.user.id.slice(-2);
            const aleatorio = crypto.randomBytes(4).toString('hex').toUpperCase();
            const chave = `CHAVE-${ultimosDois}${aleatorio}`;

            keys[interaction.user.id] = chave;
            fs.writeFileSync(KEYS_DB, JSON.stringify(keys));

            // Log no canal de chaves
            const logChan = interaction.guild.channels.cache.get(cfg.canalChaves);
            logChan?.send(`🔑 Chave de **${interaction.user.tag}**: \`${chave}\``);

            // Criar Tópico Privado no canal do painel
            const thread = await interaction.channel.threads.create({
                name: `Acesso - ${interaction.user.username}`,
                autoArchiveDuration: 60,
                type: ChannelType.PrivateThread,
                reason: 'Verificação de acesso privado',
            });

            await thread.members.add(interaction.user.id);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('abrir_modal').setLabel('Inserir Senha').setStyle(ButtonStyle.Success)
            );

            await thread.send({ 
                content: `👋 ${interaction.user}, sua chave foi gerada e enviada ao canal de logs.\n\nQuando tiver a chave, clique no botão abaixo para liberar seu acesso.`, 
                components: [row] 
            });

            await interaction.reply({ content: `✅ Tópico de verificação criado: ${thread}`, ephemeral: true });
        }

        // --- BOTÃO: ABRIR MODAL (Dentro do Tópico) ---
        if (interaction.customId === 'abrir_modal') {
            const modal = new ModalBuilder().setCustomId('modal_chave').setTitle('Validar Acesso');
            const input = new TextInputBuilder()
                .setCustomId('input_chave')
                .setLabel('Digite sua chave')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('CHAVE-XXXXXXXX')
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await interaction.showModal(modal);
        }

        // --- SUBMIT DO MODAL ---
        if (interaction.isModalSubmit() && interaction.customId === 'modal_chave') {
            const digitada = interaction.fields.getTextInputValue('input_chave');
            const correta = keys[interaction.user.id];

            if (digitada === correta) {
                const member = await interaction.guild.members.fetch(interaction.user.id);
                await member.roles.add(cfg.roleId);
                
                delete keys[interaction.user.id];
                fs.writeFileSync(KEYS_DB, JSON.stringify(keys));

                await interaction.reply({ content: '✅ Acesso liberado! Este tópico será excluído em instantes.' });
                
                // Deleta o tópico após 5 segundos
                setTimeout(() => interaction.channel.delete().catch(() => null), 5000);
            } else {
                await interaction.reply({ content: '❌ Chave incorreta! Tente novamente ou verifique se copiou certo.', ephemeral: true });
            }
        }
    },
    
    // Mantenha as outras funções abaixo (verificarSpam, etc...)
    verificarSpam: (m) => {/*... código anterior ...*/},
    verificarCriacaoCanal: (ch) => {/*... código anterior ...*/},
    verificarExclusaoCanal: (ch) => {/*... código anterior ...*/},
    verificarRaidJoin: (mem) => {/*... código anterior ...*/}
};
