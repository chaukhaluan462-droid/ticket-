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

// Cập nhật ID kênh log và ID role gdtg CỦA SERVER MỚI vào đây[cite: 1]
const LOG_CHANNEL_ID = '1527985466777927800';
const GDTG_ROLE_ID = '1527975554115178506';

const ticketData = {};

client.once('ready', () => {
    console.log(`Bot đã online với tên: ${client.user.tag}`);
});

// Lệnh tạo bảng ticket (Bao gồm cả nút Tạo Ticket và Hỗ Trợ)
client.on('messageCreate', async message => {
    if (message.author.bot) return;

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
                .setLabel('Tạo Ticket')
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
    // 1. Xử lý khi bấm nút (Button)
    if (interaction.isButton()) {
        
        // ----------------------------------------------------------------
        // XỬ LÝ TẠO TICKET GIAO DỊCH
        // ----------------------------------------------------------------
        if (interaction.customId === 'create_ticket') {
            const guild = interaction.guild;
            const user = interaction.user;

            await interaction.deferReply({ ephemeral: true });

            // Kiểm tra chống tạo lặp nếu người dùng đã có ticket mở
            const existingChannel = guild.channels.cache.find(c => c.name === `ticket-${user.username.toLowerCase()}`);
            if (existingChannel) {
                return interaction.editReply({ content: `❌ Bạn đã có một ticket đang mở tại ${existingChannel} rồi!` });
            }

            const channel = await guild.channels.create({
                name: `ticket-${user.username}`,
                type: ChannelType.GuildText,
                parent: '1527855907109736528', // ID danh mục của bạn[cite: 1]
                position: 99, 
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionsBitField.Flags.ViewChannel],
                    },
                    {
                        id: user.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                    },
                    {
                        id: GDTG_ROLE_ID,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                    },
                    {
                        id: client.user.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                    },
                ],
            });

            ticketData[channel.id] = {
                opener: `${user.tag} (<@${user.id}>)`,
                claimer: 'Chưa có ai nhận',
                closer: 'Chưa xác định'
            };

            const welcomeEmbed = new EmbedBuilder()
                .setTitle('🎫 KÊNH HỖ TRỢ & GIAO DỊCH RIÊNG TƯ')
                .setDescription(`Chào mừng <@${user.id}> đã tạo ticket hệ thống! Vui lòng cung cấp chi tiết vấn đề hoặc thông tin giao dịch của bạn tại đây để đội ngũ hỗ trợ nắm bắt nhanh nhất.`)
                .addFields(
                    { name: '📌 Trạng thái', value: '```ini\n[ Đang chờ Staff tiếp nhận ]\n```', inline: false },
                    { name: '⚠️ Lưu ý quan trọng', value: '• Không chia sẻ mật khẩu hoặc thông tin nhạy cảm.\n• Giữ thái độ văn minh, lịch sự.', inline: false }
                )
                .setColor('#00ffcc')
                .setTimestamp()
                .setFooter({ text: 'Hệ thống Quản lý Ticket Tự Động', iconURL: interaction.guild.iconURL() });

            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('Nhận Ticket').setStyle(ButtonStyle.Success).setEmoji('🙋‍♂️'),
                new ButtonBuilder().setCustomId('unclaim_ticket').setLabel('Hủy Nhận').setStyle(ButtonStyle.Secondary).setEmoji('↩️'),
                new ButtonBuilder().setCustomId('add_user_btn').setLabel('Thêm Người').setStyle(ButtonStyle.Secondary).setEmoji('➕'),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Đóng Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            await channel.send({ 
                content: `<@${user.id}> | <@&${GDTG_ROLE_ID}>`, 
                embeds: [welcomeEmbed], 
                components: [actionRow] 
            });

            await interaction.editReply({ content: `✅ Ticket của bạn đã được tạo tại: ${channel}` });
        }

        // ----------------------------------------------------------------
        // XỬ LÝ TẠO TICKET HỖ TRỢ (SUPPORT)
        // ----------------------------------------------------------------
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
                parent: '1527855907109736528', // ID danh mục của bạn[cite: 1]
                position: 99,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionsBitField.Flags.ViewChannel],
                    },
                    {
                        id: user.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                    },
                    {
                        id: GDTG_ROLE_ID,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                    },
                    {
                        id: client.user.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                    },
                ],
            });

            ticketData[channel.id] = {
                opener: `${user.tag} (<@${user.id}>)`,
                claimer: 'Chưa có ai nhận',
                closer: 'Chưa xác định'
            };

            const supportEmbed = new EmbedBuilder()
                .setTitle('🎧 KÊNH HỖ TRỢ & GIẢI ĐÁP THẮC MẮC')
                .setDescription(`Chào mừng <@${user.id}> đã kết nối với bộ phận hỗ trợ. Vui lòng nêu rõ câu hỏi hoặc vấn đề bạn đang gặp phải nhé!`)
                .addFields(
                    { name: '📌 Trạng thái', value: '```ini\n[ Đang chờ Staff tiếp nhận ]\n```', inline: false },
                    { name: '⚠️ Lưu ý quan trọng', value: '• Không chia sẻ mật khẩu hoặc thông tin nhạy cảm.\n• Giữ thái độ văn minh, lịch sự.', inline: false }
                )
                .setColor('#ffaa00')
                .setTimestamp()
                .setFooter({ text: 'Hệ thống Quản lý Ticket Tự Động', iconURL: interaction.guild.iconURL() });

            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('Nhận Ticket').setStyle(ButtonStyle.Success).setEmoji('🙋‍♂️'),
                new ButtonBuilder().setCustomId('unclaim_ticket').setLabel('Hủy Nhận').setStyle(ButtonStyle.Secondary).setEmoji('↩️'),
                new ButtonBuilder().setCustomId('add_user_btn').setLabel('Thêm Người').setStyle(ButtonStyle.Secondary).setEmoji('➕'),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Đóng Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            await channel.send({ 
                content: `<@${user.id}> | <@&${GDTG_ROLE_ID}>`, 
                embeds: [supportEmbed], 
                components: [actionRow] 
            });

            await interaction.editReply({ content: `✅ Kênh hỗ trợ của bạn đã được tạo tại: ${channel}` });
        }

        // ----------------------------------------------------------------
        // NHẬN TICKET (CLAIM)
        // ----------------------------------------------------------------
        if (interaction.customId === 'claim_ticket') {
            const channel = interaction.channel;
            const staff = interaction.user;

            if (channel.name.includes(staff.username.toLowerCase())) {
                return interaction.reply({ content: '❌ Bạn không thể tự nhận ticket do chính mình tạo ra!', ephemeral: true });
            }

            if (ticketData[channel.id] && ticketData[channel.id].claimer !== 'Chưa có ai nhận') {
                return interaction.reply({ 
                    content: `❌ Ticket này đã được tiếp nhận trước đó bởi **${ticketData[channel.id].claimer}** rồi!`, 
                    ephemeral: true 
                });
            }

            if (ticketData[channel.id]) {
                ticketData[channel.id].claimer = `${staff.tag} (<@${staff.id}>)`;
            }

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

        // ----------------------------------------------------------------
        // HỦY NHẬN TICKET (UNCLAIM)
        // ----------------------------------------------------------------
        if (interaction.customId === 'unclaim_ticket') {
            const channel = interaction.channel;
            const staff = interaction.user;

            if (!ticketData[channel.id] || ticketData[channel.id].claimer === 'Chưa có ai nhận') {
                return interaction.reply({ content: '❌ Ticket này hiện tại chưa có ai nhận để mà hủy!', ephemeral: true });
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

            await interaction.reply({ content: `🔄 **${staff.tag}** đã hủy nhận ticket. Trạng thái đã được đưa về chờ tiếp nhận!`, ephemeral: false });
        }

        // ----------------------------------------------------------------
        // THÊM NGƯỜI VÀO TICKET
        // ----------------------------------------------------------------
        if (interaction.customId === 'add_user_btn') {
            const selectMenu = new UserSelectMenuBuilder()
                .setCustomId('select_user_to_add')
                .setPlaceholder('Chọn thành viên bạn muốn thêm vào...')
                .setMinValues(1)
                .setMaxValues(1);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.reply({ 
                content: '👇 Hãy chọn thành viên từ danh sách bên dưới:', 
                components: [row], 
                ephemeral: true 
            });
        }

        // ----------------------------------------------------------------
        // ĐÓNG TICKET (GỬI BẢNG ĐÁNH GIÁ SAO)
        // ----------------------------------------------------------------
        if (interaction.customId === 'close_ticket') {
            const channel = interaction.channel;
            const closerUser = interaction.user;

            if (channel.name.includes(closerUser.username.toLowerCase())) {
                return interaction.reply({ content: '❌ Người tạo ticket không thể tự đóng ticket này. Vui lòng chờ Staff xử lý!', ephemeral: true });
            }

            if (ticketData[channel.id]) {
                ticketData[channel.id].closer = `${closerUser.tag} (<@${closerUser.id}>)`;
            }

            await interaction.reply({ content: '🔒 Đang chuẩn bị bảng đánh giá...', ephemeral: true });

            const ratingEmbed = new EmbedBuilder()
                .setTitle('⭐ Đánh Giá Chất Lượng Hỗ Trợ')
                .setDescription('Bạn hãy đánh giá trải nghiệm hỗ trợ vừa rồi bằng cách chọn số sao bên dưới:')
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

        // ----------------------------------------------------------------
        // MỞ MODAL ĐÁNH GIÁ KHI BẤM SỐ SAO
        // ----------------------------------------------------------------
        if (interaction.customId.startsWith('rate_')) {
            const stars = interaction.customId.split('_')[1];

            const modal = new ModalBuilder()
                .setCustomId(`modal_review_${stars}`)
                .setTitle(`Đánh giá ${stars} Sao`);

            const reviewInput = new TextInputBuilder()
                .setCustomId('review_text')
                .setLabel('Nhận xét của bạn về dịch vụ:')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Nhập lời nhận xét hoặc góp ý ở đây...')
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(reviewInput);
            modal.addComponents(row);

            await interaction.showModal(modal);
        }
    }

    // 2. Xử lý chọn thành viên từ Menu
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

                await interaction.update({ 
                    content: `✅ Đã thêm thành công **${targetUser.tag}** vào ticket này!`, 
                    components: [] 
                });
                
                await channel.send(`✅ **${interaction.user}** đã thêm thành viên ${targetUser} vào ticket.`);
            } catch (error) {
                console.error(error);
                await interaction.update({ 
                    content: '❌ Có lỗi xảy ra khi cấp quyền cho thành viên!', 
                    components: [] 
                });
            }
        }
    }

    // 3. Xử lý khi gửi đánh giá hoàn tất từ Modal -> Gửi Log và Xóa Kênh
    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('modal_review_')) {
            const stars = interaction.customId.split('_')[2];
            const reviewContent = interaction.fields.getTextInputValue('review_text');
            const channel = interaction.channel;
            const data = ticketData[channel.id] || { opener: 'Không rõ', claimer: 'Chưa có', closer: 'Không rõ' };

            await interaction.reply({ content: `Cảm ơn bạn đã đánh giá! Kênh sẽ tự động đóng sau 5 giây.`, ephemeral: false });

            try {
                const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);[cite: 1]
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle('📊 Nhật Ký Đánh Giá Ticket Chi Tiết')
                        .addFields(
                            { name: '👤 Người mở ticket', value: data.opener, inline: false },
                            { name: '🙋‍♂️ Người nhận ticket', value: data.claimer, inline: false },
                            { name: '🔒 Người đóng ticket', value: data.closer, inline: false },
                            { name: '⭐ Đánh giá', value: `${'⭐'.repeat(Number(stars))} (${stars}/5)`, inline: true },
                            { name: '💬 Lời nhận xét', value: reviewContent, inline: false },
                            { name: '📁 Tên kênh', value: channel.name, inline: false }
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