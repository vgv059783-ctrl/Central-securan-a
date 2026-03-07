const fs = require('node:fs');
const RAID_DB = '/app/data/antiraid.json';
const BLIND_DB = '/app/data/blindagem.json';

const caches = {
    msg: new Map(),
    ch: new Map(),
    join: new Map()
};

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
    // Lógica Anti-Spam
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

    // Lógica Anti-Criação de Canais
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

    // Lógica de Blindagem (Recriação)
    async verificarExclusaoCanal(ch) {
        if (!fs.existsSync(BLIND_DB)) return;
        const db = JSON.parse(fs.readFileSync(BLIND_DB, 'utf8'));
        const info = db[ch.guild.id]?.[ch.id];
        if (!info) return;

        const newCh = await ch.guild.channels.create({
            name: info.name, type: info.type, parent: info.parentId,
            position: info.position,
            permissionOverwrites: info.overwrites.map(o => ({ id: o.id, allow: BigInt(o.allow), deny: BigInt(o.deny), type: o.type }))
        });

        delete db[ch.guild.id][ch.id];
        db[ch.guild.id][newCh.id] = info;
        fs.writeFileSync(BLIND_DB, JSON.stringify(db, null, 2));
        sendLog(ch.guild, `🛡️ **Blindagem:** O canal \`#${info.name}\` foi recriado.`);
    },

    // Lógica Anti-Raid Join
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
    }
};
