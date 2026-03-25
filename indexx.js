const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, PermissionFlagsBits, REST, Routes, SlashCommandBuilder,
    MessageFlags
} = require('discord.js');

// --- 1. CONFIGURATION ---
const TOKEN = 'MTQ4MTI3NTYxMzg5MjQ0ODI3Ng.Gp9Xg8.9hrHr2-21cmCiSMrkmt7lylhtLarXkVgsDmbIQ'; 
const APP_ID = '1481275613892448276';
const GUILD_ID = '1475860440486641966'; 
const TESTER_ROLE_ID = "1476235865922732232";

const modes = {
    mace: { name: "Mace", role: "1480557020389179503", channel: "1480559033369759805", category: "1480556278156886040" },
    sword: { name: "Sword", role: "1480557203189665822", channel: "1482259722881990767", category: "1480556321265815754" },
    smp: { name: "SMP", role: "1480557273096130561", channel: "1480559181387006023", category: "1480556349585883257" },
    diapot: { name: "DiaPot", role: "1480557414880120914", channel: "1480559201561608212", category: "1480556410927321211" },
    diasmp: { name: "DiaSMP", role: "1480557472337887394", channel: "1480559221886943485", category: "1480556445152841869" },
    netpot: { name: "NetPot", role: "1480557507721040004", channel: "1480559244221743245", category: "1480556481316257824" },
    cart: { name: "Cart", role: "1480557543150583839", channel: "1480559259321110661", category: "1480556527503806545" },
    uhc: { name: "UHC", role: "1480557580328894474", channel: "1480559276375277669", category: "1480556555589124228" },
    crystal: { name: "Crystal", role: "1480557626168316186", channel: "1480559316330086521", category: "1480556601143328768" },
    axe: { name: "Axe", role: "1480557672515502243", channel: "1480559334659326032", category: "1480556630792863905" }
};

const activeQueues = new Map(); 
const queueLists = new Map(); 
const queueMessages = new Map(); 
const lastTierTest = new Map(); 
const cooldowns = new Map(); 
const activeTickets = new Map(); 

const client = new Client({ intents: [3276799] });
const isTester = (m) => m.roles.cache.has(TESTER_ROLE_ID);
const allModeRoleIds = Object.values(modes).map(m => m.role);

// --- 2. INTERACTION HANDLER ---
client.on('interactionCreate', async (i) => {
    if (i.isAutocomplete()) {
        const key = Object.keys(modes).find(k => modes[k].channel === i.channelId);
        if (!key) return i.respond([]);
        const focusedValue = i.options.getFocused().toLowerCase();
        const currentQueue = queueLists.get(key) || [];
        const matches = [];
        for(const id of currentQueue) {
            const m = await i.guild.members.fetch(id).catch(() => null);
            if(m && (m.user.username.toLowerCase().includes(focusedValue) || m.id.includes(focusedValue))) {
                matches.push({ name: m.user.tag, value: m.id });
            }
            if(matches.length >= 25) break;
        }
        return i.respond(matches);
    }

if (i.isButton()) {
        // --- 1. GLOBAL COOLDOWN CHECK ---
        // This blocks "Mace", "Sword", "Join", etc. if they are on cooldown.
        const cooldownEnd = cooldowns.get(i.user.id);
        if (cooldownEnd && Date.now() < cooldownEnd) {
            const remaining = Math.floor(cooldownEnd / 1000);
            return i.reply({ 
                content: `❌ You are on cooldown from your last test! You can try again <t:${remaining}:R>.`, 
                flags: MessageFlags.Ephemeral 
            });
        }

        if (i.customId.startsWith('select_')) {
            const key = i.customId.replace('select_', '');
            const mode = modes[key];
            if (!mode) return;
            const hasExistingRole = i.member.roles.cache.some(r => allModeRoleIds.includes(r.id));
            if (hasExistingRole) return i.reply({ content: "❌ You already have a waitlist role!", flags: MessageFlags.Ephemeral });
            await i.member.roles.add(mode.role).catch(() => {});
            return i.reply({ content: `✅ Added **${mode.name}** role.`, flags: MessageFlags.Ephemeral });
        }

        if (i.customId.startsWith('join_btn_')) {
            const key = i.customId.replace('join_btn_', '');
            let inAnyQueue = false;
            for (const list of queueLists.values()) { if (list.includes(i.user.id)) { inAnyQueue = true; break; } }
            if (inAnyQueue) return i.reply({ content: "❌ You are already in a queue!", flags: MessageFlags.Ephemeral });

            let q = queueLists.get(key) || [];
            q.push(i.user.id);
            queueLists.set(key, q);
            return i.reply({ content: "Joined!", flags: MessageFlags.Ephemeral });
        }

        if (i.customId.startsWith('leave_btn_')) {
            const key = i.customId.replace('leave_btn_', '');
            let q = queueLists.get(key) || [];
            queueLists.set(key, q.filter(id => id !== i.user.id));
            return i.reply({ content: "Left.", flags: MessageFlags.Ephemeral });
        }
    }

    if (!i.isChatInputCommand()) return;

    if (i.commandName === 'question') {
        if (!isTester(i.member)) return i.reply({ content: "Tester only!", flags: MessageFlags.Ephemeral });
        return i.reply("**Is your Minecraft account Cracked or Premium?**");
    }

    if (i.commandName === 'ccreset') {
        if (!isTester(i.member)) return i.reply({ content: "Tester only!", flags: MessageFlags.Ephemeral });
        const target = i.options.getUser('player');
        cooldowns.delete(target.id);
        return i.reply({ content: `✅ Cooldown reset for **${target.tag}**.`, flags: MessageFlags.Ephemeral });
    }

    if (i.isChatInputCommand() && i.commandName === 'cooldown') {
        const cooldownEnd = cooldowns.get(i.user.id);
        if (!cooldownEnd || Date.now() > cooldownEnd) {
            return i.reply({ content: "✅ You have no active cooldown.", flags: MessageFlags.Ephemeral });
        }
        const remaining = Math.floor(cooldownEnd / 1000);
        return i.reply({ 
            content: `⏳ **Cooldown Active**\nYou can test again <t:${remaining}:R>.`, 
            flags: MessageFlags.Ephemeral 
        });
    }
    
    if (i.commandName === 'leavequeue') {
        queueLists.forEach((list, key) => {
            if (list.includes(i.user.id)) queueLists.set(key, list.filter(id => id !== i.user.id));
        });
        await i.member.roles.remove(allModeRoleIds).catch(() => {});
        return i.reply({ content: "✅ Left all queues.", flags: MessageFlags.Ephemeral });
    }

    if (i.commandName === 'queue') {
        if (!isTester(i.member)) return i.reply({ content: "Tester only!", flags: MessageFlags.Ephemeral });
        const sub = i.options.getSubcommand();
        const key = Object.keys(modes).find(k => modes[k].channel === i.channelId);
        
        if (sub === 'start') {
            if (!key) return i.reply({ content: "Use this in a testing channel!", flags: MessageFlags.Ephemeral });
            activeQueues.set(key, i.user.id);
            queueLists.set(key, []); 
            return i.reply({ content: "Queue session started.", flags: MessageFlags.Ephemeral });
        }
        if (sub === 'end') {
            if (!key) return i.reply({ content: "Use this in a testing channel!", flags: MessageFlags.Ephemeral });
            activeQueues.delete(key);
            queueLists.delete(key);
            return i.reply({ content: "Queue session ended.", flags: MessageFlags.Ephemeral });
        }
        if (sub === 'finish') {
            if (!i.channel.name.startsWith('test-')) return i.reply({ content: "Only for test tickets!", flags: MessageFlags.Ephemeral });
            const userId = activeTickets.get(i.channel.id);
            // --- SET 1 DAY COOLDOWN ---
            if (userId) cooldowns.set(userId, Date.now() + (24 * 60 * 60 * 1000));
            await i.reply("Closing ticket... 1-day cooldown applied.");
            setTimeout(() => { i.channel.delete().catch(() => {}); }, 5000);
        }
        if (sub === 'skip') {
            if (!i.channel.name.startsWith('test-')) return i.reply({ content: "Only for test tickets!", flags: MessageFlags.Ephemeral });
            const userId = activeTickets.get(i.channel.id);
            if (userId) {
                const member = await i.guild.members.fetch(userId).catch(() => null);
                if (member) await member.roles.remove(allModeRoleIds).catch(() => {});
            }
            await i.reply("Skipping... No cooldown applied.");
            setTimeout(() => { i.channel.delete().catch(() => {}); }, 3000);
        }
    }

    if (i.commandName === 'qtest') {
        if (!isTester(i.member)) return;
        const playerId = i.options.getString('player');
        const key = Object.keys(modes).find(k => modes[k].channel === i.channelId);
        if(!key) return i.reply({ content: "Must be in a mode channel.", flags: MessageFlags.Ephemeral });
        const member = await i.guild.members.fetch(playerId).catch(() => null);
        if(!member) return i.reply({ content: "Player not found.", flags: MessageFlags.Ephemeral });

        lastTierTest.set(key, Date.now());
        let q = queueLists.get(key) || [];
        queueLists.set(key, q.filter(id => id !== playerId));
        await member.roles.remove(allModeRoleIds).catch(() => {});
        
        const ticket = await i.guild.channels.create({
            name: `test-${member.user.username}`,
            parent: modes[key].category,
            permissionOverwrites: [
                { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { 
                    id: playerId, 
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] 
                },
                { 
                    id: TESTER_ROLE_ID, 
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] 
                }
            ]
        });

        activeTickets.set(ticket.id, playerId);
        await ticket.send(`### Welcome <@${playerId}>!\nThis is your **${modes[key].name}** test.`);
        return i.reply({ content: `Pulled \`${member.user.tag}\` to ${ticket}.`, flags: MessageFlags.Ephemeral });
    }
});

// --- 3. REFRESH ENGINE ---
setInterval(async () => {
    if (!client.isReady()) return;
    for (const key in modes) {
        try {
            const mode = modes[key];
            const channel = client.channels.cache.get(mode.channel);
            if (!channel) continue;

            const testerId = activeQueues.get(key);
            const currentQueue = queueLists.get(key) || [];
            const lastTestTime = lastTierTest.get(key);
            
            const embed = new EmbedBuilder();
            const row = new ActionRowBuilder();
            const footerText = lastTestTime ? `Last Tier Test: <t:${Math.floor(lastTestTime / 1000)}:f>` : `No recent tier tests recorded.`;

            let messageContent = ""; // Default empty content

            if (!testerId) {
                // UI when queue is CLOSED (No Tester)
                embed.setColor(0xff4d4d) 
                    .setAuthor({ name: `[1.21+] MM Tier | Minecraft PvP Community`, iconURL: client.user.displayAvatarURL() })
                    .setTitle("No Testers Online")
                    .setDescription(`No testers available for ${mode.name}.\nYou will be pinged when a tester starts a session.\n\n${footerText}`);
                
                messageContent = ""; // Ensures "@everyone" or "LIVE" text is removed
            } else {
                // UI when queue is LIVE
                let listStr = "";
                for (let i = 0; i < 10; i++) {
                    listStr += `\`${i + 1}.\` ${currentQueue[i] ? `<@${currentQueue[i]}>` : "---"}\n`;
                }
                embed.setColor(0x2ecc71)
                    .setTitle(`${mode.name} Testing Queue`)
                    .setDescription(`**Active Tester:** <@${testerId}>\n\n**Queue:**\n${listStr}\n${footerText}`);
                
                row.addComponents(
                    new ButtonBuilder().setCustomId(`join_btn_${key}`).setLabel('Join').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`leave_btn_${key}`).setLabel('Leave').setStyle(ButtonStyle.Danger)
                );

                // Only ping/show text when the tester is actually active
                messageContent = `@everyone **${mode.name} testing is LIVE!**`;
            }

            const payload = { 
                content: messageContent, 
                embeds: [embed], 
                components: testerId ? [row] : [] 
            };

            let msg = queueMessages.get(key);
            if (msg) { 
                await msg.edit(payload).catch(() => queueMessages.delete(key)); 
            } else {
                const msgs = await channel.messages.fetch({ limit: 5 }).catch(() => null);
                const existing = msgs?.find(m => m.author.id === client.user.id && m.embeds.length > 0);
                if (existing) { 
                    queueMessages.set(key, existing); 
                    await existing.edit(payload); 
                } else { 
                    const newMsg = await channel.send(payload).catch(() => null); 
                    if (newMsg) queueMessages.set(key, newMsg); 
                }
            }
        } catch (e) { console.error(e); }
    }
}, 3000);

client.once('ready', async () => {
    const commands = [
        new SlashCommandBuilder().setName('question').setDescription('Cracked or Premium?'),
        new SlashCommandBuilder().setName('leavequeue').setDescription('Leave queues'),
        new SlashCommandBuilder().setName('ccreset').setDescription('Reset cooldown').addUserOption(o => o.setName('player').setRequired(true).setDescription('The player')),
        new SlashCommandBuilder().setName('cooldown').setDescription('Check your cooldown'),
        new SlashCommandBuilder().setName('queue').setDescription('Manage queue')
            .addSubcommand(s => s.setName('start').setDescription('Start'))
            .addSubcommand(s => s.setName('end').setDescription('Stop'))
            .addSubcommand(s => s.setName('skip').setDescription('Skip'))
            .addSubcommand(s => s.setName('finish').setDescription('Finish')),
        new SlashCommandBuilder().setName('qtest').setDescription('Pull player')
            .addStringOption(o => o.setName('player').setRequired(true).setAutocomplete(true).setDescription('The player')),
    ].map(c => c.toJSON());
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try { await rest.put(Routes.applicationGuildCommands(APP_ID, GUILD_ID), { body: commands }); console.log("Ready."); } catch (err) { console.error(err); }
});

client.login(TOKEN);