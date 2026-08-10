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

// CẤU HÌNH ID KÊNH VÀ ROLE
const LOG_CHANNEL_ID = '1527985466777927800';
const GDTG_ROLE_ID = '1527975554115178506';
const ADMIN_REPORT_CHANNEL_ID = 'ĐIỀN_ID_KÊNH_ADMIN_VÀO_ĐÂY'; // ID kênh riêng của Admin để nhận báo cáo

const ticketData = {};
const completedTickets = {}; 
const staffRatings = {}; 

client.once('ready', () => {
    console.log(`Bot đã online với tên: ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // Lệnh báo cáo qua text: !baocao <lý do> hoặc !report <lý do>
    if (message.content.startsWith('!baocao') || message.content.startsWith('!report')) {
        const channel = message.channel;
        
        // Kiểm tra xem có đang ở trong kênh ticket hợp lệ không
        const data = ticketData[channel.id];
        if (!data) {
            return message.reply({ content: '❌ Lệnh này chỉ có thể sử dụng bên trong các kênh ticket giao dịch!', ephemeral: true });
        }

        if (!data.claimer || data.claimer === 'Chưa có ai nhận') {
            return message.reply({ content: '❌ Hiện chưa có Staff nào tiếp nhận ticket này để báo cáo!', ephemeral: true });
        }

        // Lấy lý do sau lệnh (ví dụ: !baocao staff vòi vĩnh tiền)
        const args = message.content.split(' ').slice(1).join(' ');
        if (!args) {
            return message.reply({ content: '❌ Vui lòng nhập lý do báo cáo cụ thể. Ví dụ: `!baocao Staff lừa đảo / treo kèo quá lâu`', ephemeral: true });
        }

        const reportedStaff = data.claimer;

        try {
            const reportChannel = await client.channels.fetch(1536207079008899153);
            if (reportChannel) {
                const reportEmbed = new EmbedBuilder()
                    .setTitle('🚨 CẢNH BÁO: CÓ BÁO CÁO TỪ KHÁCH HÀNG (QUA LỆNH)')
                    .addFields(
                        { name: 'Kênh Ticket', value: `<#${channel.id}> (${channel.name})`, inline: true },
                        { name: 'Khách khiếu nại', value: `<@${message.author.id}>`, inline: true },
                        { name: 'Staff bị tố cáo', value: reportedStaff, inline: true },
                        { name: 'Lý do cụ thể', value: `\`\`\`${args}\`\`\``, inline: false }
                    )
                    .setColor('#ff0000')
                    .setTimestamp();
                
                await reportChannel.send({ content: '@here Có khiếu nại khẩn cấp từ khách hàng trong ticket!', embeds: [reportEmbed] });
            }
        } catch (err) {
            console.error('Lỗi khi gửi report:', err);
        }

        // Xóa tin nhắn lệnh của khách để giữ sạch ticket, thay bằng thông báo xác nhận
        await message.delete().catch(() => {});
        return message.channel.send({ content: `✅ <@${message.author.id}> Đã gửi báo cáo thành công đến Ban quản lý!` });
    }

    // Lệnh xem bảng xếp hạng Top Staff
    if (message.content === '!topstaff') {
        if (Object.keys(completedTickets).length === 0) {
            return message.reply('📊 Hiện tại chưa có Staff nào hoàn thành kèo GDTG nào.');
        }

        const sortedStaff = Object.entries(completedTickets)
            .sort((a, b) => b[1] - a[1]);

        let description = '';
        sortedStaff.forEach(([staffId, count], index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**#${index + 1}**`;
            
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

    // Lệnh kiểm tra chỉ số
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
            .setTitle('🎫 Kênh Trung Gian Giao Dịch')
            .setDescription(`>>> 🛡️ **HỆ THỐNG TICKET TRUNG GIAN** 🛡️

• 📌 **Mục đích:** Hỗ trợ giao dịch an toàn và nhanh chóng.
• 📩 **Cách sử dụng:** Nhấn nút **Tạo Ticket GDTG** bên dưới để mở form nhập thông tin giao dịch.
• 💡 *Mẹo:* Gõ lệnh \`!baocao [lý do]\` trong ticket nếu bạn cần khiếu nại thái độ hoặc sự cố về Staff.

✨ *Cam kết uy tín - Bảo mật tuyệt đối - Phản hồi nhanh chóng!*`)
            .setColor('#0099ff');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel('Tạo Ticket GDTG')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📩')
        );

        await message.channel.send({ embeds: [embed], components: [row] });
        await message.delete();
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        
        // 1. Mở Modal Form Nhập Thông Tin Giao Dịch
        if (interaction.customId === 'create_ticket') {
            const modal = new ModalBuilder()
                .setCustomId('modal_gdtg_form')
                .setTitle('📋 NHẬP THÔNG TIN GIAO DỊCH');

            const personInput = new TextInputBuilder()
                .setCustomId('deal_person')
                .setLabel('1. Tên người cần giao dịch')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Nhập tên hoặc tag người cần giao dịch...')
                .setRequired(true);

            const itemInput = new TextInputBuilder()
                .setCustomId('deal_item')
                .setLabel('2. Đồ cần giao dịch')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Nhập tên tài nguyên, vật phẩm, tài khoản...')
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(personInput),
                new ActionRowBuilder().addComponents(itemInput)
            );

            await interaction.showModal(modal);
        }

        // 2. Nhận Ticket
        if (interaction.customId === 'claim_ticket') {
            const channel = interaction.channel;
            const staff = interaction.user;

            if (channel.name.includes(staff.username.toLowerCase())) {
                return interaction.reply({ content: '❌ Bạn không thể tự nhận ticket do chính mình tạo ra!', ephemeral: true });
            }

            if (!ticketData[channel.id]) {
                ticketData[channel.id] = { openerId: '', claimer: 'Chưa có ai nhận', closer: 'Chưa xác định', reviewer: 'Chưa đánh giá', dealInfo: 'Chưa cập nhật' };
            }

            if (ticketData[channel.id].claimer !== 'Chưa có ai nhận') {
                return interaction.reply({ content: `❌ Ticket này đã được tiếp nhận bởi **${ticketData[channel.id].claimer}**!`, ephemeral: true });
            }

            ticketData[channel.id].claimer = `<@${staff.id}>`;

            const messages = await channel.messages.fetch({ limit: 10 });
            const welcomeMessage = messages.find(m => m.embeds.length > 0 && m.components.length > 0);

            if (welcomeMessage) {
                const oldEmbed = welcomeMessage.embeds[0];
                const fields = oldEmbed.fields.map(f => {
                    if (f.name === '📌 Trạng thái') {
                        return { name: '📌 Trạng thái', value: `\`\`\`ini\n[ Đã được tiếp nhận bởi ${staff.tag} ]\n\`\`\``, inline: false };
                    }
                    return f;
                });
                const updatedEmbed = EmbedBuilder.from(oldEmbed).setFields(fields);
                await welcomeMessage.edit({ embeds: [updatedEmbed] });
            }

            await interaction.reply({ content: `✅ **${staff.tag}** đã nhận xử lý ticket này!`, ephemeral: false });
        }

        // 3. Hủy Nhận Ticket
        if (interaction.customId === 'unclaim_ticket') {
            const channel = interaction.channel;
            const staff = interaction.user;

            if (!ticketData[channel.id]) {
                ticketData[channel.id] = { openerId: '', claimer: 'Chưa có ai nhận', closer: 'Chưa xác định', reviewer: 'Chưa đánh giá', dealInfo: 'Chưa cập nhật' };
            }

            if (ticketData[channel.id].claimer === 'Chưa có ai nhận') {
                return interaction.reply({ content: '❌ Ticket chưa có ai nhận để hủy!', ephemeral: true });
            }

            ticketData[channel.id].claimer = 'Chưa có ai nhận';

            const messages = await channel.messages.fetch({ limit: 10 });
            const welcomeMessage = messages.find(m => m.embeds.length > 0 && m.components.length > 0);

            if (welcomeMessage) {
                const oldEmbed = welcomeMessage.embeds[0];
                const fields = oldEmbed.fields.map(f => {
                    if (f.name === '📌 Trạng thái') {
                        return { name: '📌 Trạng thái', value: '```ini\n[ Đang chờ Staff tiếp nhận ]\n```', inline: false };
                    }
                    return f;
                });
                const updatedEmbed = EmbedBuilder.from(oldEmbed).setFields(fields);
                await welcomeMessage.edit({ embeds: [updatedEmbed] });
            }

            await interaction.reply({ content: `🔄 **${staff.tag}** đã hủy nhận ticket.`, ephemeral: false });
        }

        // 4. Chuyển Nhượng Ticket
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

        // 5. Thêm Người
        if (interaction.customId === 'add_user_btn') {
            const selectMenu = new UserSelectMenuBuilder()
                .setCustomId('select_user_to_add')
                .setPlaceholder('Chọn thành viên bạn muốn thêm vào...')
                .setMinValues(1)
                .setMaxValues(1);

            const row = new ActionRowBuilder().addComponents(selectMenu);
            await interaction.reply({ content: '👇 Hãy chọn thành viên:', components: [row], ephemeral: true });
        }

        // 6. Đóng Ticket (Gọn gàng chỉ còn 2 hàng nút)
        if (interaction.customId === 'close_ticket') {
            const channel = interaction.channel;
            const closerUser = interaction.user;

            if (channel.name.includes(closerUser.username.toLowerCase())) {
                return interaction.reply({ content: '❌ Người tạo ticket không thể tự đóng ticket!', ephemeral: true });
            }

            if (!ticketData[channel.id]) {
                ticketData[channel.id] = { openerId: '', claimer: 'Chưa có ai nhận', closer: 'Chưa xác định', reviewer: 'Chưa đánh giá', dealInfo: 'Không có thông tin' };
            }
            ticketData[channel.id].closer = `<@${closerUser.id}>`;

            await interaction.reply({ content: '🔒 Đang chuẩn bị bảng đánh giá...', ephemeral: true });

            const ratingEmbed = new EmbedBuilder()
                .setTitle('⭐ Đánh Giá Chất Lượng Giao Dịch')
                .setDescription('Vui lòng đánh giá trải nghiệm giao dịch bằng cách chọn số sao bên dưới *(Chỉ người mở ticket mới có quyền đánh giá)*:')
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

        // 7. Mở Modal Đánh Giá Sao (Chỉ người mở)
        if (interaction.customId.startsWith('rate_')) {
            const channel = interaction.channel;
            const user = interaction.user;

            let data = ticketData[channel.id];
            let openerId = data ? data.openerId : null;

            if (!openerId) {
                try {
                    const fetchedMessages = await channel.messages.fetch({ limit: 10 });
                    const pinnedMsg = fetchedMessages.find(m => m.pinned);
                    if (pinnedMsg) {
                        const match = pinnedMsg.content.match(/<@!?(\d+)>/);
                        if (match) openerId = match[1];
                    }
                } catch (e) {
                    console.error(e);
                }
            }

            if (openerId && user.id !== openerId) {
                return interaction.reply({ content: '❌ Chỉ có **người mở ticket** mới có quyền đánh giá chất lượng giao dịch này!', ephemeral: true });
            }

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
                await channel.permissionOverwrites.create(targetUser.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
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
            if (targetStaff.id === currentStaff.id) return interaction.update({ content: '❌ Bạn không thể tự chuyển vé lại cho chính mình!', components: [] });
            if (!ticketData[channel.id]) { ticketData[channel.id] = { openerId: '', claimer: 'Chưa có ai nhận', closer: 'Chưa xác định', reviewer: 'Chưa đánh giá', dealInfo: 'Chưa cập nhật' }; }
            ticketData[channel.id].claimer = `<@${targetStaff.id}>`;
            try {
                await channel.permissionOverwrites.create(targetStaff.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
                const messages = await channel.messages.fetch({ limit: 10 });
                const welcomeMessage = messages.find(m => m.embeds.length > 0 && m.components.length > 0);
                if (welcomeMessage) {
                    const oldEmbed = welcomeMessage.embeds[0];
                    const fields = oldEmbed.fields.map(f => {
                        if (f.name === '📌 Trạng thái') return { name: '📌 Trạng thái', value: `\`\`\`ini\n[ Đã chuyển giao cho ${targetStaff.tag} ]\n\`\`\``, inline: false };
                        return f;
                    });
                    const updatedEmbed = EmbedBuilder.from(oldEmbed).setFields(fields);
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

    // Xử lý Submit Modal (Tạo Ticket & Đánh giá)
    if (interaction.isModalSubmit()) {
        
        // A. KHI KHÁCH TẠO TICKET GDTG
        if (interaction.customId === 'modal_gdtg_form') {
            const guild = interaction.guild;
            const user = interaction.user;

            const dealPerson = interaction.fields.getTextInputValue('deal_person');
            const dealItem = interaction.fields.getTextInputValue('deal_item');

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

            const dealInfoText = `• **Tên người cần giao dịch:** ${dealPerson}\n• **Đồ cần giao dịch:** ${dealItem}`;

            ticketData[channel.id] = {
                openerId: user.id,
                opener: `<@${user.id}>`,
                claimer: 'Chưa có ai nhận',
                closer: 'Chưa xác định',
                reviewer: 'Chưa đánh giá',
                dealInfo: dealInfoText
            };

            const welcomeEmbed = new EmbedBuilder()
                .setTitle('🎫 THÔNG TIN GIAO DỊCH TRUNG GIAN')
                .setDescription(`Chào mừng <@${user.id}> đã tạo ticket! Dưới đây là thông tin chi tiết về kèo giao dịch:\n\n💡 *Gợi ý: Nếu Staff có hành vi vòi vĩnh hoặc chậm trễ, bạn có thể gõ lệnh \`!baocao [lý do]\` ngay tại đây để báo cho Admin.*`)
                .addFields(
                    { name: '📌 Trạng thái', value: '```ini\n[ Đang chờ Staff tiếp nhận ]\n```', inline: false },
                    { name: '📋 Chi tiết giao dịch', value: dealInfoText, inline: false },
                    { name: '⚠️ Lưu ý quan trọng', value: '• Không chia sẻ mật khẩu hoặc thông tin nhạy cảm.\n• Giữ thái độ văn minh, lịch sự.', inline: false }
                )
                .setColor('#00ffcc')
                .setTimestamp();

            // Panel rút gọn còn 2 dòng, mỗi dòng 3 nút rất gọn gàng
            const actionRow1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('Nhận Ticket').setStyle(ButtonStyle.Success).setEmoji('🙋‍♂️'),
                new ButtonBuilder().setCustomId('unclaim_ticket').setLabel('Hủy Nhận').setStyle(ButtonStyle.Secondary).setEmoji('↩️'),
                new ButtonBuilder().setCustomId('transfer_ticket_btn').setLabel('Chuyển Ticket').setStyle(ButtonStyle.Secondary).setEmoji('➡️')
            );

            const actionRow2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('add_user_btn').setLabel('Thêm Người').setStyle(ButtonStyle.Secondary).setEmoji('➕'),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Đóng Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            const sentMessage = await channel.send({ content: `<@${user.id}> | <@&${GDTG_ROLE_ID}>`, embeds: [welcomeEmbed], components: [actionRow1, actionRow2] });
            await sentMessage.pin();

            await interaction.editReply({ content: `✅ Ticket của bạn đã được tạo tại: ${channel}` });
        }

        // B. KHI KHÁCH ĐÁNH GIÁ SAO
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
                        if (match) openerText = `<@${match[1]}>`;
                    }
                } catch (e) {
                    console.error(e);
                }

                data = {
                    opener: openerText,
                    claimer: claimerText,
                    closer: `<@${reviewerUser.id}>`,
                    reviewer: `<@${reviewerUser.id}>`,
                    dealInfo: 'Không có thông tin'
                };
            } else {
                if (!data.opener || data.opener === 'Không rõ') {
                    data.opener = `<@${data.openerId}>`;
                }
                data.reviewer = `<@${reviewerUser.id}>`;
                if (!data.closer || data.closer === 'Chưa xác định') {
                    data.closer = `<@${reviewerUser.id}>`;
                }
            }

            let totalCompletedText = '0 kèo';
            let staffFieldTitle = 'Số kèo GDTG';
            let staffIdMatch = data.claimer.match(/<@!?(\d+)>/);
            
            let avgRatingDisplay = 'Chưa có';

            if (staffIdMatch) {
                const staffId = staffIdMatch[1];
                
                completedTickets[staffId] = (completedTickets[staffId] || 0) + 1;
                totalCompletedText = `<@${staffId}> đã hoàn thành: **${completedTickets[staffId]}** kèo`;

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
                        .setTitle('📊 Nhật Ký Giao Dịch & Đánh Giá Ticket')
                        .addFields(
                            { name: '👤 Người mở ticket', value: data.opener, inline: true },
                            { name: '🙋‍♂️ Người nhận ticket', value: data.claimer, inline: true },
                            { name: '📋 Thông tin giao dịch', value: data.dealInfo || 'Không có', inline: false },
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