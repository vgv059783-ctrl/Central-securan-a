const fs = require('node:fs');
const RAID_DB = '/app/data/antiraid.json';
const BLIND_DB = '/app/data/blindagem.json';

const caches = {
    msg: new Map(),
    ch: new Map(),
    join: new Map()const fs = require('node:fs');
const crypto = require('crypto');
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

// Caminhos dos arquivos no volume do Railway
const RAID_DB = '/app/data/antiraid.json';
const BLIND_DB = '/app/data/blindagem.json';
const PRIVADO_DB = '/app/data/privado.json';
const KEYS_DB = '/app/data/keys.json';

const caches = {
    msg: new Map(),
    ch: new Map(),
    join: new Map()
};

// Função auxiliar para enviar logs nos canais configurados
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
    // 🛡️ ANTI-SPAM (+10 msgs em 3s)
    async verificarSpam(m) {
        if (m.author.bot || !m.guild) return;
        const now = Date.now();
        if (!caches.msg.has(m.author.id)) caches.msg.set(m.author.id, []);
        const times = caches.msg.get(m.author.id);
        times.push(now);
        const recent = times.filter(t => now - t < 3000);
        caches.msg.set(m.author.id, recent);

        if (recent.length >= 10 && m.member?.manageable) {
            await m.member.timeout(86400000, 'Anti-Spam').catch(() => null);
            sendLog(m.guild, `🚨 **Punido:** ${m.author} castigado por 24h (Spam).`);
        }
    },

    // 🛡️ ANTI-CANAL (+7 canais em 3s)
    async verificarCriacaoCanal(ch) {
        const audit = await ch.guild.fetchAuditLogs({ limit: 1, type: 10 }).catch(() => null);
        const entry = audit?.entries.first();
        if (!entry) return;
        const now = Date.now();
        if (!caches.ch.has(entry.executor.id)) caches.ch.set(entry.executor.id, []);
        const acts = caches.ch.get(entry.executor.id);
        acts.push(now);
        const recent = acts.filter(t => now - t < 3000);
        caches.ch.set(entry.executor.id, recent);

        if (recent.length >= 7) {
            const mem = await ch.guild.members.fetch(entry.executor.id).catch(() => null);
            if (mem?.manageable) {
                await mem.timeout(86400000, 'Criação excessiva de canais').catch(() => null);
                sendLog(ch.guild, `🚨 **Punido:** ${mem.user.tag} castigado por 24h (Canais).`);
            }
        }
    },

    // 🔒 BLINDAGEM (Recriação de canais excluídos)
    async verificarExclusaoCanal(ch) {
        if (!fs.existsSync(BLIND_DB)) return;
        const db = JSON.parse(fs.readFileSync(BLIND_DB, 'utf8'));
        const info = db[ch.guild.id]?.[ch.id];
        if (!info) return;

        const newCh = await ch.guild.channels.create({
            name: info.name, type: info.type, parent: info.parentId,
            position: info.position,
            permissionOverwrites: info.overwrites.map(o => ({ 
                id: o.id, allow: BigInt(o.allow), deny: BigInt(o.deny), type: o.type 
            }))
        });

        delete db[ch.guild.id][ch.id];
        db[ch.guild.id][newCh.id] = info;
        fs.writeFileSync(BLIND_DB, JSON.stringify(db, null, 2));
        sendLog(ch.guild, `🛡️ **Blindagem:** Canal \`#${info.name}\` recriado automaticamente.`);
    },

    // 🛡️ ANTI-RAID JOIN (+5 pessoas em 10s)
    async verificarRaidJoin(mem) {
        if (!fs.existsSync(RAID_DB)) return;
        const cfg = JSON.parse(fs.readFileSync(RAID_DB, 'utf8'));
        if (!cfg[mem.guild.id]?.enabled) return;
        const now = Date.now();
        if (!caches.join.has(mem.guild.id)) caches.join.set(mem.guild.id, []);
        const r = caches.join.get(mem.guild.id).filter(t => now - t < 10000);
        r.push(now);
        caches.join.set(mem.guild.id, r);

        if (r.length > 5 && mem.manageable) {
            await mem.timeout(86400000, 'Anti-Raid Join').catch(() => null);
            sendLog(mem.guild, `🚨 **Anti-Raid:** ${mem.user.tag} silenciado (Entrada em massa).`);
        }
    },

    // 🔑 SISTEMA DE VERIFICAÇÃO (BOTÃO E MODAL)
    async lidarVerificacao(interaction) {
        if (!fs.existsSync(PRIVADO_DB)) return;
        const config = JSON.parse(fs.readFileSync(PRIVADO_DB, 'utf8'));
        const cfg = config[interaction.guildId];
        if (!cfg) return;

        // Gerar Chave (Botão)
        if (interaction.customId === 'gerar_chave') {
            const ultimosDois = interaction.user.id.slice(-2);
            const aleatorio = crypto.randomBytes(4).toString('hex').toUpperCase();
            const chave = `CHAVE-${ultimosDois}${aleatorio}`;

            const keys = fs.existsSync(KEYS_DB) ? JSON.parse(fs.readFileSync(KEYS_DB)) : {};
            keys[interaction.user.id] = chave;
            fs.writeFileSync(KEYS_DB, JSON.stringify(keys));

            const logChan = interaction.guild.channels.cache.get(cfg.canalChaves);
            logChan?.send(`🔑 Chave de **${interaction.user.tag}**: \`${chave}\``);

            const modal = new ModalBuilder().setCustomId('modal_chave').setTitle('Verificação de Acesso');
            const input = new TextInputBuilder()
                .setCustomId('input_chave')
                .setLabel('Insira a chave gerada')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('CHAVE-XXXXXXXX')
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await interaction.showModal(modal);
        }

        // Validar Chave (Modal Submit)
        if (interaction.isModalSubmit() && interaction.customId === 'modal_chave') {
            if (!fs.existsSync(KEYS_DB)) return;
            const keys = JSON.parse(fs.readFileSync(KEYS_DB, 'utf8'));
            const digitada = interaction.fields.getTextInputValue('input_chave');
            const correta = keys[interaction.user.id];

            if (digitada === correta) {
                const member = await interaction.guild.members.fetch(interaction.user.id);
                await member.roles.add(cfg.roleId);
                delete keys[interaction.user.id];
                fs.writeFileSync(KEYS_DB, JSON.stringify(keys));
                await interaction.reply({ content: '✅ Acesso liberado!', ephemeral: true });
            } else {
                await interaction.reply({ content: '❌ Chave incorreta.', ephemeral: true });
            }
        }
    }
};
