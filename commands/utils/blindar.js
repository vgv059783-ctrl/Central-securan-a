const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const B_PATH = '/app/data/blindagem.json';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blindar')
        .setDescription('Salva as configs dos canais para recriação automática')
        .addStringOption(opt => opt.setName('alvo').setDescription('O que blindar?').addChoices(
            { name: 'Todos os canais', value: 'todos' },
            { name: 'Apenas este canal', value: 'este' }
        ).setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        if (!fs.existsSync('/app/data')) fs.mkdirSync('/app/data', { recursive: true });
        
        let db = fs.existsSync(B_PATH) ? JSON.parse(fs.readFileSync(B_PATH, 'utf8')) : {};
        const alvo = interaction.options.getString('alvo');
        const guildId = interaction.guildId;

        db[guildId] = db[guildId] || {};

        const canaisParaSalvar = alvo === 'todos' 
            ? interaction.guild.channels.cache.filter(c => !c.isThread()) 
            : [interaction.channel];

        canaisParaSalvar.forEach(ch => {
            db[guildId][ch.id] = {
                name: ch.name,
                type: ch.type,
                parentId: ch.parentId,
                position: ch.rawPosition,
                overwrites: ch.permissionOverwrites.cache.map(o => ({
                    id: o.id,
                    allow: o.allow.bitfield.toString(),
                    deny: o.deny.bitfield.toString(),
                    type: o.type
                }))
            };
        });

        fs.writeFileSync(B_PATH, JSON.stringify(db, null, 2));
        await interaction.reply({ content: `🔒 **Blindagem configurada!** ${alvo === 'todos' ? 'O servidor inteiro' : 'Este canal'} está protegido.`, ephemeral: true });
    }
};
