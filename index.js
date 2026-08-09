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

// 1. Cập nhật ID kênh log và ID role gdtg CỦA SERVER MỚI vào đây
const LOG_CHANNEL_ID = '1527985466777927800';
const GDTG_ROLE_ID = '1527975554115178506';

const ticketData = {};

client.once('ready', () => {
    console.log(`Bot đã online với tên: ${client.user.tag}`);
});

// Lệnh tạo bảng ticket
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content === '!setup-ticket') {
        const embed = new EmbedBuilder()
    .setTitle('🎫 Kênh Hỗ Trợ & Trung Gian')
    .setDescription(`>>> 🛡️ **HỆ THỐNG TICKET TRUNG GIAN & HỖ TRỢ** 🛡️

• 📌 **Mục đích:** Hỗ trợ giao dịch an toàn, giải đáp thắc mắc và xử lý khiếu nại.
• 📩 **Cách sử dụng:** Nhấn nút **Tạo Ticket** bên dưới để mở kênh chat riêng tư 1-1 với đội ngũ quản trị viên.

✨ *Cam kết uy tín - Bảo mật tuyệt đối - Phản hồi nhanh chóng!*`)
    .setColor('#0099ff');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel('Tạo Ticket')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📩')
        );

        await message.channel.send({ embeds: [embed], components: [row] });
        await message.delete();
    }
});

client.on('interactionCreate', async interaction => {
    // 1. Xử lý khi bấm nút (Button)
    if (interaction.isButton()) {
        // Tạo Ticket
        if (interaction.customId === 'create_ticket') {
            const guild = interaction.guild;
            const user = interaction.user;

          const channel = await guild.channels.create({
                name: `ticket-${user.username}`,
                type: ChannelType.GuildText,
                parent: '1527855907109736528', // 👈 Điền ID danh mục vào đây
                position: 99, // Đặt số lớn để nó tự động đẩy xuống dưới cùng của danh mục
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

            // 🌟 EMBED CHÀO MỪNG MỚI HOÀNH TRÁNG & ĐẦY ĐỦ THÔNG TIN
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

            // Giữ nguyên 3 nút: Nhận Ticket, Thêm Người, Đóng Ticket
            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('Nhận Ticket').setStyle(ButtonStyle.Success).setEmoji('🙋‍♂️'),
                new ButtonBuilder().setCustomId('add_user_btn').setLabel('Thêm Người').setStyle(ButtonStyle.Secondary).setEmoji('➕'),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Đóng Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            await channel.send({ 
                content: `<@${user.id}> | <@&${GDTG_ROLE_ID}>`, 
                embeds: [welcomeEmbed], 
                components: [actionRow] 
            });

            await interaction.reply({ content: `✅ Ticket của bạn đã được tạo tại: ${channel}`, ephemeral: true });
        }

        // Nhận Ticket (Claim)
        if (interaction.customId === 'claim_ticket') {
            const channel = interaction.channel;
            const staff = interaction.user;

            if (channel.name === `ticket-${staff.username.toLowerCase()}`) {
                return interaction.reply({ content: '❌ Bạn không thể tự nhận ticket do chính mình tạo ra!', ephemeral: true });
            }

            // 🛑 KIỂM TRA XEM TICKET ĐÃ CÓ AI NHẬN CHƯA
            if (ticketData[channel.id] && ticketData[channel.id].claimer !== 'Chưa có ai nhận') {
                return interaction.reply({ 
                    content: `❌ Ticket này đã được tiếp nhận trước đó bởi **${ticketData[channel.id].claimer}** rồi! Bạn không thể nhận đè nữa.`, 
                    ephemeral: true 
                });
            }

            if (ticketData[channel.id]) {
                ticketData[channel.id].claimer = `${staff.tag} (<@${staff.id}>)`;
            }

            // 1. Tìm lại tin nhắn chào mừng ban đầu (tin nhắn chứa Embed và các nút bấm)
            const messages = await channel.messages.fetch({ limit: 10 });
            const welcomeMessage = messages.find(m => m.embeds.length > 0 && m.components.length > 0);

            if (welcomeMessage) {
                const oldEmbed = welcomeMessage.embeds[0];

                // 2. Tạo Embed mới với trạng thái đã được cập nhật tên Staff đầu tiên nhận
                const updatedEmbed = EmbedBuilder.from(oldEmbed).setFields(
                    { name: '📌 Trạng thái', value: `\`\`\`ini\n[ Đã được tiếp nhận bởi ${staff.tag} ]\n\`\`\``, inline: false },
                    { name: '⚠️ Lưu ý quan trọng', value: '• Không chia sẻ mật khẩu hoặc thông tin nhạy cảm.\n• Giữ thái độ văn minh, lịch sử.', inline: false }
                );

                // 3. Cập nhật lại tin nhắn đó trên Discord
                await welcomeMessage.edit({ embeds: [updatedEmbed] });
            }

            await interaction.reply({ content: `✅ **${staff.tag}** đã nhận xử lý ticket này!`, ephemeral: false });
        }

        // Hủy Nhận Ticket (Unclaim) để đổi người khác
        if (interaction.customId === 'unclaim_ticket') {
            const channel = interaction.channel;
            const staff = interaction.user;

            // Kiểm tra xem ticket này có đang được nhận bởi ai không
            if (!ticketData[channel.id] || ticketData[channel.id].claimer === 'Chưa có ai nhận') {
                return interaction.reply({ content: '❌ Ticket này hiện tại chưa có ai nhận để mà hủy!', ephemeral: true });
            }

            // Đặt lại dữ liệu về chưa có ai nhận
            ticketData[channel.id].claimer = 'Chưa có ai nhận';

            // Tìm lại tin nhắn chào mừng để update lại bảng Embed thành "Đang chờ..."
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

        // Khi bấm nút "Thêm Người" -> Hiện menu chọn thành viên (Chỉ người bấm mới thấy)
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

        // Đóng Ticket -> Gửi bảng đánh giá sao
        if (interaction.customId === 'close_ticket') {
            const channel = interaction.channel;
            const closerUser = interaction.user;

            if (channel.name === `ticket-${closerUser.username.toLowerCase()}`) {
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

        // Khi bấm vào các nút chọn sao -> Hiện bảng Modal viết lời đánh giá
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

    // 2. Xử lý khi người dùng chọn thành viên từ Menu (User Select Menu)
    if (interaction.isUserSelectMenu()) {
        if (interaction.customId === 'select_user_to_add') {
            const targetUser = interaction.users.first();
            const channel = interaction.channel;

            try {
                // Cấp quyền xem và nhắn tin trong kênh ticket cho thành viên được chọn
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

    // 3. Xử lý khi người dùng gửi thông tin từ bảng Modal đánh giá sao
    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('modal_review_')) {
            const stars = interaction.customId.split('_')[2];
            const reviewContent = interaction.fields.getTextInputValue('review_text');
            const channel = interaction.channel;
            const data = ticketData[channel.id] || { opener: 'Không rõ', claimer: 'Chưa có', closer: 'Không rõ' };

            await interaction.reply({ content: `Cảm ơn bạn đã đánh giá! Kênh sẽ tự động đóng sau 5 giây.`, ephemeral: false });

            try {
                const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
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

// Điền Token Bot của bạn vào đây 👇
client.login(process.env.DISCORD_TOKEN);