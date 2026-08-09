const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionsBitField, 
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    UserSelectMenuBuilder
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const LOG_CHANNEL_ID = '1527985466777927800';
const GDTG_ROLE_ID = '1527975554115178506';

const ticketData = {};
const completedTickets = {}; 
const staffRatings = {}; // Lưu trữ lịch sử đánh giá sao của từng Staff: { staffId: { totalStars: 0, count: 0 } }

client.once('ready', () => {
    console.log(`Bot đã online với tên: ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // Lệnh xem bảng xếp hạng Top Staff
    if (message.content === '!topstaff') {
        if (Object.keys(completedTickets).length === 0) {
            return message.reply('📊 Hiện tại chưa có Staff nào hoàn thành kèo GDTG nào.');
        }

        // Sắp xếp các staff theo số lượng kèo giảm dần
        const sortedStaff = Object.entries(completedTickets)
            .sort((a, b) => b[1] - a[1]);

        let description = '';
        sortedStaff.forEach(([staffId, count], index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**#${index + 1}**`;
            
            // Tính điểm trung bình sao nếu có
            let avgRatingText = 'Chưa có đánh giá';
            if (staffRatings[staffId] && staffRatings[staffId].count > 0) {
                const avg = (staffRatings[staffId].totalStars / staffRatings[staffId].count).toFixed(1);
                avgRatingText = `${avg}/5 ⭐ (${staffRatings[staffId].count} đánh giá)`;
            }

            description += `${medal} <@${staffId}> — **${count}** kèo *(Độ uy tín: ${avgRatingText})*\n`;
        });

        const topEmbed = new EmbedBuilder()
            .setTitle('🏆 BẢNG XẾP HẠNG TOP STAFF GDTG')
            .setDescription(description)
            .setColor('#ffd700')
            .setTimestamp();

        return message.reply({ embeds: [topEmbed] });
    }

    // Lệnh kiểm tra chỉ số của Staff bất kỳ (!stats @staff)
    if (message.content.startsWith('!stats')) {
        const targetUser = message.mentions.users.first();
        if (!targetUser) {
            return message.reply('❌ Vui lòng tag một Staff cụ thể để xem chỉ số. Ví dụ: `!stats @username`');
        }

        const staffId = targetUser.id;
        const totalCompleted = completedTickets[staffId] || 0;

        let avgRatingText = 'Chưa có đánh giá';
        let totalCount = 0;

        if (staffRatings[staffId] && staffRatings[staffId].count > 0) {
            totalCount = staffRatings[staffId].count;
            const avg = (staffRatings[staffId].totalStars / totalCount).toFixed(1);
            avgRatingText = `${avg}/5 ⭐`;
        }

        const statsEmbed = new EmbedBuilder()
            .setTitle(`📊 THỐNG KÊ GDTG - ${targetUser.username}`)
            .setDescription(`Thông tin hiệu suất làm việc của <@${staffId}>:`)
            .addFields(
                { name: '🛡️ Tổng số kèo đã hoàn thành', value: `**${totalCompleted}** kèo`, inline: true },
                { name: '⭐ Độ uy tín trung bình', value: avgRatingText, inline: true },
                { name: '📝 Tổng số lượt đánh giá', value: `**${totalCount}** lượt`, inline: false }
            )
            .setColor('#00ffcc')
            .setTimestamp();

        return message.reply({ embeds: [statsEmbed] });
    }

    if (message.content === '!setup-ticket') {
        const embed = new EmbedBuilder()
            .setTitle('🎫 Kênh Hỗ Trợ & Trung Gian')
            .setDescription(`>>> 🛡️ **HỆ THỐNG TICKET TRUNG GIAN & HỖ TRỢ** 🛡️

• 📌 **Mục đích:** Hỗ trợ giao dịch an toàn, giải đáp thắc mắc và xử lý khiếu nại.
• 📩 **Cách sử dụng:** Nhấn nút **Tạo Ticket** để giao dịch hoặc nút **Hỗ Trợ** nếu bạn cần giải đáp thắc mắc chung.

✨ *Cam kết uy tín - Bảo mật tuyệt đối - Phản hồi nhanh chóng!*`)
            .setColor('#0099ff');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel('Tạo Ticket GDTG')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📩'),
            new ButtonBuilder()
                .setCustomId('support_ticket')
                .setLabel('Hỗ Trợ')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🎧')
        );

        await message.channel.send({ embeds: [embed], components: [row] });
        await message.delete();
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        
        // 1. Tạo Ticket Giao Dịch
        if (interaction.customId === 'create_ticket') {
            const guild = interaction.guild;
            const user = interaction.user;

            await interaction.deferReply({ ephemeral: true });

            const existingChannel = guild.channels.cache.find(c => c.name === `ticket-${user.username.toLowerCase()}`);
            if (existingChannel) {
                return interaction.editReply({ content: `❌ Bạn đã có một ticket đang mở tại ${existingChannel} rồi!` });
            }

            const channel = await guild.channels.create({
                name: `ticket-${user.username}`,
                type: ChannelType.GuildText,
                parent: '1527855907109736528',
                position: 99, 
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                    { id: GDTG_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                    { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                ],
            });

            ticketData[channel.id] = {
                opener: `${user.tag} (<@${user.id}>)`,
                claimer: 'Chưa có ai nhận',
                closer: 'Chưa xác định',
                reviewer: 'Chưa đánh giá'
            };

            const welcomeEmbed = new EmbedBuilder()
                .setTitle('🎫 KÊNH HỖ TRỢ & GIAO DỊCH RIÊNG TƯ')
                .setDescription(`Chào mừng <@${user.id}> đã tạo ticket hệ thống! Vui lòng cung cấp chi tiết vấn đề hoặc thông tin giao dịch của bạn tại đây.`)
                .addFields(
                    { name: '📌 Trạng thái', value: '```ini\n[ Đang chờ Staff tiếp nhận ]\n```', inline: false },
                    { name: '⚠️ Lưu ý quan trọng', value: '• Không chia sẻ mật khẩu hoặc thông tin nhạy cảm.\n• Giữ thái độ văn minh, lịch sự.', inline: false }
                )
                .setColor('#00ffcc')
                .setTimestamp();

            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('Nhận Ticket').setStyle(ButtonStyle.Success).setEmoji('🙋‍♂️'),
                new ButtonBuilder().setCustomId('unclaim_ticket').setLabel('Hủy Nhận').setStyle(ButtonStyle.Secondary).setEmoji('↩️'),
                new ButtonBuilder().setCustomId('transfer_ticket_btn').setLabel('Chuyển Ticket').setStyle(ButtonStyle.Primary).setEmoji('➡️'),
                new ButtonBuilder().setCustomId('add_user_btn').setLabel('Thêm Người').setStyle(ButtonStyle.Secondary).setEmoji('➕'),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Đóng Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            const sentMessage = await channel.send({ content: `<@${user.id}> | <@&${GDTG_ROLE_ID}>`, embeds: [welcomeEmbed], components: [actionRow] });
            await sentMessage.pin();

            await interaction.editReply({ content: `✅ Ticket của bạn đã được tạo tại: ${channel}` });
        }

        // 2. Tạo Ticket Hỗ Trợ (Support)
        if (interaction.customId === 'support_ticket') {
            const guild = interaction.guild;
            const user = interaction.user;

            await interaction.deferReply({ ephemeral: true });

            const existingSupportChannel = guild.channels.cache.find(c => c.name === `support-${user.username.toLowerCase()}`);
            if (existingSupportChannel) {
                return interaction.editReply({ content: `❌ Bạn đã có một kênh hỗ trợ đang mở tại ${existingSupportChannel} rồi!` });
            }

            const channel = await guild.channels.create({
                name: `support-${user.username}`,
                type: ChannelType.GuildText,
                parent: '1527855907109736528',
                position: 99,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                    { id: GDTG_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                    { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                ],
            });

            ticketData[channel.id] = {
                opener: `${user.tag} (<@${user.id}>)`,
                claimer: 'Chưa có ai nhận',
                closer: 'Chưa xác định',
                reviewer: 'Chưa đánh giá'
            };

            const supportEmbed = new EmbedBuilder()
                .setTitle('🎧 KÊNH HỖ TRỢ & GIẢI ĐÁP THẮC MẮC')
                .setDescription(`Chào mừng <@${user.id}> đã kết nối với bộ phận hỗ trợ. Vui lòng nêu rõ câu hỏi hoặc vấn đề của bạn!`)
                .addFields(
                    { name: '📌 Trạng thái', value: '```ini\n[ Đang chờ Staff tiếp nhận ]\n```', inline: false },
                    { name: '⚠️ Lưu ý quan trọng', value: '• Không chia sẻ mật khẩu hoặc thông tin nhạy cảm.\n• Giữ thái độ văn minh, lịch sự.', inline: false }
                )
                .setColor('#ffaa00')
                .setTimestamp();

            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('Nhận Ticket').setStyle(ButtonStyle.Success).setEmoji('🙋‍♂️'),
                new ButtonBuilder().setCustomId('unclaim_ticket').setLabel('Hủy Nhận').setStyle(ButtonStyle.Secondary).setEmoji('↩️'),
                new ButtonBuilder().setCustomId('transfer_ticket_btn').setLabel('Chuyển Ticket').setStyle(ButtonStyle.Primary).setEmoji('➡️'),
                new ButtonBuilder().setCustomId('add_user_btn').setLabel('Thêm Người').setStyle(ButtonStyle.Secondary).setEmoji('➕'),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Đóng Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            const sentMessageSupport = await channel.send({ content: `<@${user.id}> | <@&${GDTG_ROLE_ID}>`, embeds: [supportEmbed], components: [actionRow] });
            await sentMessageSupport.pin();

            await interaction.editReply({ content: `✅ Kênh hỗ trợ của bạn đã được tạo tại: ${channel}` });
        }

        // 3. Nhận Ticket
        if (interaction.customId === 'claim_ticket') {
            const channel = interaction.channel;
            const staff = interaction.user;

            if (channel.name.includes(staff.username.toLowerCase())) {
                return interaction.reply({ content: '❌ Bạn không thể tự nhận ticket do chính mình tạo ra!', ephemeral: true });
            }

            if (!ticketData[channel.id]) {
                ticketData[channel.id] = { opener: 'Không rõ', claimer: 'Chưa có ai nhận', closer: 'Chưa xác định', reviewer: 'Chưa đánh giá' };
            }

            if (ticketData[channel.id].claimer !== 'Chưa có ai nhận') {
                return interaction.reply({ content: `❌ Ticket này đã được tiếp nhận bởi **${ticketData[channel.id].claimer}**!`, ephemeral: true });
            }

            ticketData[channel.id].claimer = `${staff.tag} (<@${staff.id}>)`;

            const messages = await channel.messages.fetch({ limit: 10 });
            const welcomeMessage = messages.find(m => m.embeds.length > 0 && m.components.length > 0);

            if (welcomeMessage) {
                const oldEmbed = welcomeMessage.embeds[0];
                const updatedEmbed = EmbedBuilder.from(oldEmbed).setFields(
                    { name: '📌 Trạng thái', value: `\`\`\`ini\n[ Đã được tiếp nhận bởi ${staff.tag} ]\n\`\`\``, inline: false },
                    { name: '⚠️ Lưu ý quan trọng', value: '• Không chia sẻ mật khẩu hoặc thông tin nhạy cảm.\n• Giữ thái độ văn minh, lịch sử.', inline: false }
                );
                await welcomeMessage.edit({ embeds: [updatedEmbed] });
            }

            await interaction.reply({ content: `✅ **${staff.tag}** đã nhận xử lý ticket này!`, ephemeral: false });
        }

        // 4. Hủy Nhận Ticket
        if (interaction.customId === 'unclaim_ticket') {
            const channel = interaction.channel;
            const staff = interaction.user;

            if (!ticketData[channel.id]) {
                ticketData[channel.id] = { opener: 'Không rõ', claimer: 'Chưa có ai nhận', closer: 'Chưa xác định', reviewer: 'Chưa đánh giá' };
            }

            if (ticketData[channel.id].claimer === 'Chưa có ai nhận') {
                return interaction.reply({ content: '❌ Ticket chưa có ai nhận để hủy!', ephemeral: true });
            }

            ticketData[channel.id].claimer = 'Chưa có ai nhận';

            const messages = await channel.messages.fetch({ limit: 10 });
            const welcomeMessage = messages.find(m => m.embeds.length > 0 && m.components.length > 0);

            if (welcomeMessage) {
                const oldEmbed = welcomeMessage.embeds[0];
                const updatedEmbed = EmbedBuilder.from(oldEmbed).setFields(
                    { name: '📌 Trạng thái', value: '```ini\n[ Đang chờ Staff tiếp nhận ]\n```', inline: false },
                    { name: '⚠️ Lưu ý quan trọng', value: '• Không chia sẻ mật khẩu hoặc thông tin nhạy cảm.\n• Giữ thái độ văn minh, lịch sử.', inline: false }
                );
                await welcomeMessage.edit({ embeds: [updatedEmbed] });
            }

            await interaction.reply({ content: `🔄 **${staff.tag}** đã hủy nhận ticket.`, ephemeral: false });
        }

        // 5. Chuyển Nhượng Ticket
        if (interaction.customId === 'transfer_ticket_btn') {
            const channel = interaction.channel;
            const staff = interaction.user;

            if (!ticketData[channel.id] || ticketData[channel.id].claimer === 'Chưa có ai nhận') {
                return interaction.reply({ content: '❌ Ticket này chưa được ai nhận, bạn không thể chuyển nhượng!', ephemeral: true });
            }

            if (!ticketData[channel.id].claimer.includes(staff.id)) {
                return interaction.reply({ content: '❌ Chỉ Staff đang tiếp nhận ticket này mới có quyền chuyển nhượng!', ephemeral: true });
            }

            const selectMenu = new UserSelectMenuBuilder()
                .setCustomId('select_staff_to_transfer')
                .setPlaceholder('Chọn Staff muốn bàn giao vé này...')
                .setMinValues(1)
                .setMaxValues(1);

            const row = new ActionRowBuilder().addComponents(selectMenu);
            await interaction.reply({ content: '👇 Hãy chọn đồng nghiệp bạn muốn chuyển giao vé:', components: [row], ephemeral: true });
        }

        // 6. Thêm Người
        if (interaction.customId === 'add_user_btn') {
            const selectMenu = new UserSelectMenuBuilder()
                .setCustomId('select_user_to_add')
                .setPlaceholder('Chọn thành viên bạn muốn thêm vào...')
                .setMinValues(1)
                .setMaxValues(1);

            const row = new ActionRowBuilder().addComponents(selectMenu);
            await interaction.reply({ content: '👇 Hãy chọn thành viên:', components: [row], ephemeral: true });
        }

        // 7. Đóng Ticket
        if (interaction.customId === 'close_ticket') {
            const channel = interaction.channel;
            const closerUser = interaction.user;

            if (channel.name.includes(closerUser.username.toLowerCase())) {
                return interaction.reply({ content: '❌ Người tạo ticket không thể tự đóng ticket!', ephemeral: true });
            }

            if (!ticketData[channel.id]) {
                ticketData[channel.id] = { opener: 'Không rõ', claimer: 'Chưa có ai nhận', closer: 'Chưa xác định', reviewer: 'Chưa đánh giá' };
            }
            ticketData[channel.id].closer = `${closerUser.tag} (<@${closerUser.id}>)`;

            await interaction.reply({ content: '🔒 Đang chuẩn bị bảng đánh giá...', ephemeral: true });

            const ratingEmbed = new EmbedBuilder()
                .setTitle('⭐ Đánh Giá Chất Lượng Hỗ Trợ')
                .setDescription('Vui lòng đánh giá trải nghiệm hỗ trợ bằng cách chọn số sao bên dưới:')
                .setColor('#ffcc00');

            const ratingRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('rate_1').setLabel('⭐ 1').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('rate_2').setLabel('⭐⭐ 2').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('rate_3').setLabel('⭐⭐⭐ 3').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('rate_4').setLabel('⭐⭐⭐⭐ 4').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('rate_5').setLabel('⭐⭐⭐⭐⭐ 5').setStyle(ButtonStyle.Success),
            );

            await channel.send({ embeds: [ratingEmbed], components: [ratingRow] });
        }

        // 8. Mở Modal Đánh Giá Sao
        if (interaction.customId.startsWith('rate_')) {
            const stars = interaction.customId.split('_')[1];
            const modal = new ModalBuilder()
                .setCustomId(`modal_review_${stars}`)
                .setTitle(`Đánh giá ${stars} Sao`);

            const reviewInput = new TextInputBuilder()
                .setCustomId('review_text')
                .setLabel('Nhận xét của bạn:')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Nhập lời nhận xét...')
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(reviewInput));
            await interaction.showModal(modal);
        }
    }

    // Xử lý menu chọn user
    if (interaction.isUserSelectMenu()) {
        if (interaction.customId === 'select_user_to_add') {
            const targetUser = interaction.users.first();
            const channel = interaction.channel;

            try {
                await channel.permissionOverwrites.create(targetUser.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });

                await interaction.update({ content: `✅ Đã thêm **${targetUser.tag}** vào ticket!`, components: [] });
                await channel.send(`✅ **${interaction.user}** đã thêm thành viên ${targetUser} vào ticket.`);
            } catch (error) {
                console.error(error);
                await interaction.update({ content: '❌ Lỗi khi cấp quyền!', components: [] });
            }
        }

        if (interaction.customId === 'select_staff_to_transfer') {
            const targetStaff = interaction.users.first();
            const channel = interaction.channel;
            const currentStaff = interaction.user;

            if (targetStaff.id === currentStaff.id) {
                return interaction.update({ content: '❌ Bạn không thể tự chuyển vé lại cho chính mình!', components: [] });
            }

            if (!ticketData[channel.id]) {
                ticketData[channel.id] = { opener: 'Không rõ', claimer: 'Chưa có ai nhận', closer: 'Chưa xác định', reviewer: 'Chưa đánh giá' };
            }
            ticketData[channel.id].claimer = `${targetStaff.tag} (<@${targetStaff.id}>)`;

            try {
                await channel.permissionOverwrites.create(targetStaff.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });

                const messages = await channel.messages.fetch({ limit: 10 });
                const welcomeMessage = messages.find(m => m.embeds.length > 0 && m.components.length > 0);

                if (welcomeMessage) {
                    const oldEmbed = welcomeMessage.embeds[0];
                    const updatedEmbed = EmbedBuilder.from(oldEmbed).setFields(
                        { name: '📌 Trạng thái', value: `\`\`\`ini\n[ Đã chuyển giao cho ${targetStaff.tag} ]\n\`\`\``, inline: false },
                        { name: '⚠️ Lưu ý quan trọng', value: '• Không chia sẻ mật khẩu hoặc thông tin nhạy cảm.\n• Giữ thái độ văn minh, lịch sử.', inline: false }
                    );
                    await welcomeMessage.edit({ embeds: [updatedEmbed] });
                }

                await interaction.update({ content: `✅ Đã chuyển nhượng ticket thành công cho **${targetStaff.tag}**!`, components: [] });
                await channel.send(`🔄 **${currentStaff}** đã chuyển nhượng ticket này cho ${targetStaff}. Nhờ bạn tiếp tục hỗ trợ khách hàng nhé!`);
            } catch (error) {
                console.error(error);
                await interaction.update({ content: '❌ Có lỗi xảy ra khi chuyển nhượng ticket!', components: [] });
            }
        }
    }

    // Xử lý submit modal đánh giá
    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('modal_review_')) {
            const stars = Number(interaction.customId.split('_')[2]);
            const reviewContent = interaction.fields.getTextInputValue('review_text');
            const channel = interaction.channel;
            const reviewerUser = interaction.user;

            let data = ticketData[channel.id];

            if (!data) {
                let openerText = 'Không rõ';
                let claimerText = 'Chưa có';
                try {
                    const fetchedMessages = await channel.messages.fetch({ limit: 10 });
                    const pinnedMsg = fetchedMessages.find(m => m.pinned);
                    if (pinnedMsg) {
                        const match = pinnedMsg.content.match(/<@!?(\d+)>/);
                        if (match) {
                            openerText = `<@${match[1]}>`;
                        } else if (pinnedMsg.author) {
                            openerText = `${pinnedMsg.author.tag} (<@${pinnedMsg.author.id}>)`;
                        }

                        const embed = pinnedMsg.embeds[0];
                        if (embed && embed.fields) {
                            const statusField = embed.fields.find(f => f.name === '📌 Trạng thái');
                            if (statusField && statusField.value.includes('tiếp nhận')) {
                                claimerText = statusField.value.replace(/```ini|\[|\]/g, '').trim();
                            }
                        }
                    }
                } catch (e) {
                    console.error('Không thể quét tin nhắn ghim:', e);
                }

                if (openerText === 'Không rõ') {
                    const usernamePart = channel.name.replace('ticket-', '').replace('support-', '');
                    openerText = usernamePart;
                }

                data = {
                    opener: openerText,
                    claimer: claimerText,
                    closer: `${reviewerUser.tag} (<@${reviewerUser.id}>)`,
                    reviewer: `${reviewerUser.tag} (<@${reviewerUser.id}>)`
                };
            } else {
                if (!data.opener || data.opener === 'Không rõ') {
                    const usernamePart = channel.name.replace('ticket-', '').replace('support-', '');
                    data.opener = usernamePart;
                }
                data.reviewer = `${reviewerUser.tag} (<@${reviewerUser.id}>)`;
                if (!data.closer || data.closer === 'Chưa xác định') {
                    data.closer = `${reviewerUser.tag} (<@${reviewerUser.id}>)`;
                }
            }

            // --- XỬ LÝ TÍNH SỐ KÈO VÀ ĐIỂM TRUNG BÌNH SAO ---
            let totalCompletedText = '0 kèo';
            let staffFieldTitle = 'Số kèo GDTG';
            let staffIdMatch = data.claimer.match(/<@!?(\d+)>/);
            
            let avgRatingDisplay = 'Chưa có';

            if (staffIdMatch) {
                const staffId = staffIdMatch[1];
                
                // Tăng số kèo hoàn thành
                completedTickets[staffId] = (completedTickets[staffId] || 0) + 1;
                totalCompletedText = `<@${staffId}> đã thành: **${completedTickets[staffId]}** kèo`;

                // Lưu trữ và tính điểm trung bình sao cho Staff
                if (!staffRatings[staffId]) {
                    staffRatings[staffId] = { totalStars: 0, count: 0 };
                }
                staffRatings[staffId].totalStars += stars;
                staffRatings[staffId].count += 1;

                const avg = (staffRatings[staffId].totalStars / staffRatings[staffId].count).toFixed(1);
                avgRatingDisplay = `${avg}/5 ⭐ (Tổng ${staffRatings[staffId].count} đánh giá)`;
            }

            await interaction.reply({ content: `Cảm ơn bạn đã đánh giá! Kênh sẽ đóng sau 5 giây.`, ephemeral: false });

            try {
                const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle('📊 Nhật Ký Đánh Giá Ticket Chi Tiết')
                        .addFields(
                            { name: '👤 Người mở ticket', value: data.opener, inline: true },
                            { name: '🙋‍♂️ Người nhận ticket', value: data.claimer, inline: true },
                            { name: '🔒 Người đóng ticket', value: data.closer, inline: true },
                            { name: '✍️ Người đánh giá', value: data.reviewer, inline: true },
                            { name: '⭐ Đánh giá lượt này', value: `${'⭐'.repeat(stars)} (${stars}/5)`, inline: true },
                            { name: '📈 Điểm TB của Staff', value: avgRatingDisplay, inline: true },
                            { name: '💬 Lời nhận xét', value: reviewContent, inline: false },
                            { name: staffFieldTitle, value: totalCompletedText, inline: false }
                        )
                        .setColor('#00ffcc')
                        .setTimestamp();

                    await logChannel.send({ embeds: [logEmbed] });
                }
            } catch (err) {
                console.error('Lỗi gửi log:', err);
            }

            delete ticketData[channel.id];
            setTimeout(async () => {
                try {
                    await channel.delete();
                } catch (error) {
                    console.log('Kênh đã được xóa.');
                }
            }, 5000);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);