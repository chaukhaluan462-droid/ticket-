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
    TextInputStyle
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
            .setTitle('🎫 Hệ Thống Hỗ Trợ (Ticket)')
            .setDescription('Nhấn vào nút bên dưới để tạo yêu cầu hỗ trợ riêng tư.')
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
            permissionOverwrites: [
                {
                    id: guild.id, // Chặn mọi người không liên quan
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
                {
                    id: user.id, // Người tạo ticket được xem
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                },
                {
                    id: GDTG_ROLE_ID, // Cấp quyền cho role gdtg được xem kênh ticket này
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                },
                {
                    id: client.user.id, // Bot được phép quản lý
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
                .setTitle(`Chào mừng, ${user.username}!`)
                .setDescription('Vui lòng trình bày vấn đề của bạn. Nhấn **Nhận Ticket** nếu bạn là Staff, hoặc **Đóng Ticket** khi hoàn tất.')
                .setColor('#00ff00');

            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('Nhận Ticket').setStyle(ButtonStyle.Success).setEmoji('🙋‍♂️'),
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

            if (ticketData[channel.id]) {
                ticketData[channel.id].claimer = `${staff.tag} (<@${staff.id}>)`;
            }

            await interaction.reply({ content: `✅ **${staff.tag}** đã nhận xử lý ticket này!`, ephemeral: false });
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

    // 2. Xử lý khi người dùng bấm Gửi (Submit) bảng Modal đánh giá
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