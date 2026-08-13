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
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers // Bật quyền này để hiển thị danh sách thành viên khi dùng lệnh /add
    ]
});

// --- CẤU HÌNH ID KÊNH & ROLE HỆ THỐNG ---
const VOUCH_LOG_CHANNEL_ID = '1537333769189720147';       // Kênh chung để gửi vouch (log đánh giá)
const ADMIN_REPORT_CHANNEL_ID = '1537333911095611443';    // Kênh report scammer gửi về cho Owner

// 🛡️ Các Role quản lý hệ thống chung
const OWNER_ROLE_ID = '1436983276777509010';             // Role Owner
const MANAGER_ROLE_ID = '1437440890011521105';         // Role Manager

// 🛡️ Role chức năng riêng biệt
const GDTG_STAFF_ROLE_ID = '1440714450247090257';       // Nhân viên GDTG
const SELLER_ROLE_ID = '1441449735192838245';           // Role Seller (cho ticket mua hàng)

// --- BỘ NHỚ LƯU TRỮ TẠM THỜI (DATABASE IN-MEMORY) ---
const ticketData = {};
const completedTickets = {}; 
const staffRatings = {}; 
const userDeposits = {}; 

client.once('ready', () => {
    console.log(`Bot Discord đã khởi động thành công với tên: ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // --- LỆNH QUẢN LÝ TIỀN CỌC: !tiencoc @user số_tiền ---
    if (message.content.startsWith('!tiencoc')) {
        const member = message.member;
        const isStaff = member.roles.cache.has(OWNER_ROLE_ID) ||
                        member.permissions.has(PermissionsBitField.Flags.Administrator);
        
        if (!isStaff) {
            return message.reply({ content: '❌ Bạn không có quyền sử dụng lệnh quản lý tiền cọc này!', ephemeral: true });
        }

        const args = message.content.split(' ').slice(1);
        const targetUser = message.mentions.users.first();
        if (!targetUser || args.length < 2) {
            return message.reply('❌ Sai cú pháp! Vui lòng sử dụng: `!tiencoc @user <số_tiền>` (Ví dụ: `!tiencoc @user 500k` hoặc `!tiencoc @user 2m`)');
        }

        let rawAmountStr = args.slice(1).join('').toLowerCase();
        let multiplier = 1;
        if (rawAmountStr.includes('k')) { 
            multiplier = 1000; 
            rawAmountStr = rawAmountStr.replace('k', ''); 
        } else if (rawAmountStr.includes('m')) { 
            multiplier = 1000000; 
            rawAmountStr = rawAmountStr.replace('m', ''); 
        }

        const numericValue = parseFloat(rawAmountStr);
        if (isNaN(numericValue)) {
            return message.reply('❌ Giá trị số tiền không hợp lệ! Vui lòng kiểm tra lại.');
        }

        const addedAmount = numericValue * multiplier;
        userDeposits[targetUser.id] = (userDeposits[targetUser.id] || 0) + addedAmount;

        const successEmbed = new EmbedBuilder()
            .setTitle('💰 CẬP NHẬT TIỀN CỌC GIAO DỊCH')
            .setDescription(`Đã cập nhật số dư tiền cọc cho thành viên <@${targetUser.id}>.`)
            .addFields(
                { name: '➕ Số tiền thay đổi', value: `${addedAmount.toLocaleString('vi-VN')} VNĐ`, inline: true },
                { name: '💎 Tổng tiền cọc hiện tại', value: `**${userDeposits[targetUser.id].toLocaleString('vi-VN')}** VNĐ`, inline: true }
            )
            .setColor('#00ffcc')
            .setTimestamp();

        return message.reply({ embeds: [successEmbed] });
    }

    // --- LỆNH KIỂM TRA TIỀN CỌC: !checkcoc @user ---
    if (message.content.startsWith('!checkcoc')) {
        const targetUser = message.mentions.users.first() || message.author;
        const currentDeposit = userDeposits[targetUser.id] || 0;

        const checkEmbed = new EmbedBuilder()
            .setTitle('🔍 THÔNG TIN TIỀN CỌC')
            .setDescription(`Số tiền cọc hiện tại của <@${targetUser.id}> là: **${currentDeposit.toLocaleString('vi-VN')}** VNĐ`)
            .setColor('#3498db')
            .setTimestamp();

        return message.reply({ embeds: [checkEmbed] });
    }

    // --- SETUP PANEL TICKET GỐC (3 NÚT TÍCH HỢP) ---
    if (message.content === '!setup-ticket') {
        const embed = new EmbedBuilder()
            .setTitle('🎫 HỆ THỐNG TICKET DỊCH VỤ & HỖ TRỢ TRUNG TÂM')
            .setDescription(`>>> 🛡️ **TRUNG TÂM GIAO DỊCH & HỖ TRỢ AN TOÀN 24/7** 🛡️

• 📌 **Tạo Ticket GDTG:** Dùng cho trung gian giao dịch tài sản, hiện vật, tài khoản an toàn tuyệt đối.
• 🛒 **Mua Hàng:** Mua sắm các sản phẩm, dịch vụ trực tiếp từ shop hoặc seller uy tín.
• 🚨 **Report Scammer:** Tố cáo lừa đảo, khiếu nại khẩn cấp gửi trực tiếp đến Ban Quản Trị.

✨ *Cam kết uy tín - Minh bạch - Bảo mật tuyệt đối cho mọi khách hàng!*`)
            .setColor('#0099ff')
            .setFooter({ text: 'Hệ thống tự động quản lý ticket' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('create_gdtg_ticket').setLabel('Tạo Ticket GDTG').setStyle(ButtonStyle.Primary).setEmoji('📩'),
            new ButtonBuilder().setCustomId('create_buy_ticket').setLabel('Mua Hàng').setStyle(ButtonStyle.Success).setEmoji('🛒'),
            new ButtonBuilder().setCustomId('create_report_ticket').setLabel('Report Scammer').setStyle(ButtonStyle.Danger).setEmoji('🚨')
        );

        await message.channel.send({ embeds: [embed], components: [row] });
        await message.delete().catch(() => {});
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        
        // 1. Mở Modal GDTG
        if (interaction.customId === 'create_gdtg_ticket') {
            const modal = new ModalBuilder().setCustomId('modal_gdtg_form').setTitle('📋 THÔNG TIN GIAO DỊCH TRUNG GIAN');
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('deal_person').setLabel('1. Tên người cần giao dịch cùng').setStyle(TextInputStyle.Short).setPlaceholder('Nhập tên hoặc mention người mua/bán...').setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('deal_item').setLabel('2. Tài sản / Đồ cần giao dịch').setStyle(TextInputStyle.Short).setPlaceholder('Ví dụ: Acc Blox Fruits, 500k Robux...').setRequired(true)
                )
            );
            await interaction.showModal(modal);
        }

        // 2. Mở Modal Mua Hàng
        if (interaction.customId === 'create_buy_ticket') {
            const modal = new ModalBuilder().setCustomId('modal_buy_form').setTitle('🛒 THÔNG TIN MUA HÀNG');
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('buy_item').setLabel('Sản phẩm / Dịch vụ muốn mua').setStyle(TextInputStyle.Short).setPlaceholder('Nhập tên sản phẩm bạn muốn đặt mua...').setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('buy_note').setLabel('Ghi chú thêm cho Seller').setStyle(TextInputStyle.Short).setPlaceholder('Ví dụ: Server, thời gian nhận, yêu cầu riêng...').setRequired(false)
                )
            );
            await interaction.showModal(modal);
        }

        // 3. Mở Modal Report Scammer
        if (interaction.customId === 'create_report_ticket') {
            const modal = new ModalBuilder().setCustomId('modal_report_form').setTitle('🚨 REPORT SCAMMER');
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('scammer_name').setLabel('Tên hoặc ID đối tượng bị tố cáo').setStyle(TextInputStyle.Short).setPlaceholder('Nhập tên/link/ID Discord kẻ lừa đảo...').setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('scammer_proof').setLabel('Bằng chứng / Chi tiết sự việc').setStyle(TextInputStyle.Paragraph).setPlaceholder('Mô tả chi tiết và đính kèm link hình ảnh/video bằng chứng...').setRequired(true)
                )
            );
            await interaction.showModal(modal);
        }

        // 4. Nhân viên bấm Claim Ticket
        if (interaction.customId === 'claim_ticket') {
            const member = interaction.member;
            const isStaff = member.roles.cache.has(GDTG_STAFF_ROLE_ID) || 
                            member.roles.cache.has(SELLER_ROLE_ID) || 
                            member.roles.cache.has(OWNER_ROLE_ID) || 
                            member.roles.cache.has(MANAGER_ROLE_ID) || 
                            member.permissions.has(PermissionsBitField.Flags.Administrator);

            if (!isStaff) {
                return interaction.reply({ content: '❌ Chỉ có Nhân viên GDTG, Seller hoặc Quản trị viên mới có thể nhận ticket này!', ephemeral: true });
            }

            const channel = interaction.channel;
            const staff = interaction.user;
            if (!ticketData[channel.id]) {
                ticketData[channel.id] = { type: 'gdtg', claimer: 'Chưa có' };
            }
            ticketData[channel.id].claimer = `<@${staff.id}>`;
            
            const claimEmbed = new EmbedBuilder()
                .setDescription(`✅ Nhân viên/Seller **${staff.tag}** đã tiếp nhận và xử lý ticket này!`)
                .setColor('#2ecc71');

            await interaction.reply({ embeds: [claimEmbed], ephemeral: false });
        }

        // 5. Yêu cầu Đóng Ticket -> Kiểm tra quyền Staff/Seller/Owner/Manager trước
        if (interaction.customId === 'close_ticket') {
            const member = interaction.member;
            
            // Kiểm tra xem người bấm có phải là Staff, Seller, Owner, Manager hoặc Admin không
            const isStaff = member.roles.cache.has(GDTG_STAFF_ROLE_ID) || 
                            member.roles.cache.has(OWNER_ROLE_ID) || 
                            member.roles.cache.has(MANAGER_ROLE_ID) || 
                            member.permissions.has(PermissionsBitField.Flags.Administrator);

            // Nếu không phải nhân viên/quản lý thì chặn lại, khách hàng thường không bấm được
            if (!isStaff) {
                return interaction.reply({ content: '❌ Chỉ có Nhân viên GDTG, Seller hoặc Quản trị viên mới có quyền đóng ticket này!', ephemeral: true });
            }

            const channel = interaction.channel;
            const data = ticketData[channel.id] || { type: 'gdtg' };

            const optionsEmbed = new EmbedBuilder()
                .setTitle('🔒 TÙY CHỌN ĐÓNG KÊNH TICKET')
                .setDescription('Bạn có muốn đánh giá chất lượng dịch vụ trước khi đóng vé này không?')
                .setColor('#ffaa00');

            const optionsRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_instant').setLabel('Đóng Ngay Lập Tức').setStyle(ButtonStyle.Danger).setEmoji('🚪'),
                new ButtonBuilder().setCustomId(data.type === 'buy' ? 'open_buy_rating' : 'open_rating_panel').setLabel('Đánh Giá Dịch Vụ').setStyle(ButtonStyle.Success).setEmoji('⭐')
            );
            return interaction.reply({ embeds: [optionsEmbed], components: [optionsRow], ephemeral: true });
        }

        // 6. Đóng ngay lập tức
        if (interaction.customId === 'close_instant') {
            const channel = interaction.channel;
            await interaction.update({ content: '🚪 Kênh ticket đã được đóng theo yêu cầu.', embeds: [], components: [] });
            delete ticketData[channel.id];
            setTimeout(() => channel.delete().catch(() => {}), 3000);
        }

        // 7. Mở bảng đánh giá sao cho GDTG
        if (interaction.customId === 'open_rating_panel') {
            const channel = interaction.channel;
            await interaction.update({ content: '✅ Mở bảng đánh giá chất lượng GDTG:', embeds: [], components: [] });
            const ratingEmbed = new EmbedBuilder()
                .setTitle('⭐ ĐÁNH GIÁ DỊCH VỤ GDTG')
                .setDescription('Vui lòng chọn số sao tương ứng với độ hài lòng của bạn đối với nhân viên phụ trách:')
                .setColor('#ffcc00');

            const ratingRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('rate_gdtg_1').setLabel('⭐ 1').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('rate_gdtg_2').setLabel('⭐⭐ 2').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('rate_gdtg_3').setLabel('⭐⭐⭐ 3').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('rate_gdtg_4').setLabel('⭐⭐⭐⭐ 4').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('rate_gdtg_5').setLabel('⭐⭐⭐⭐⭐ 5').setStyle(ButtonStyle.Success),
            );
            await channel.send({ embeds: [ratingEmbed], components: [ratingRow] });
        }

        // 8. Mở bảng đánh giá sao cho Mua Hàng
        if (interaction.customId === 'open_buy_rating') {
            const channel = interaction.channel;
            await interaction.update({ content: '✅ Mở bảng đánh giá sản phẩm/mua hàng:', embeds: [], components: [] });
            const ratingEmbed = new EmbedBuilder()
                .setTitle('🛒 ĐÁNH GIÁ DỊCH VỤ MUA HÀNG')
                .setDescription('Vui lòng chọn số sao để đánh giá sản phẩm và trải nghiệm mua hàng:')
                .setColor('#00ffcc');

            const ratingRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('rate_buy_1').setLabel('⭐ 1').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('rate_buy_2').setLabel('⭐⭐ 2').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('rate_buy_3').setLabel('⭐⭐⭐ 3').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('rate_buy_4').setLabel('⭐⭐⭐⭐ 4').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('rate_buy_5').setLabel('⭐⭐⭐⭐⭐ 5').setStyle(ButtonStyle.Success),
            );
            await channel.send({ embeds: [ratingEmbed], components: [ratingRow] });
        }

        // Kích hoạt Modal nhập nội dung review GDTG
        if (interaction.customId.startsWith('rate_gdtg_')) {
            const stars = interaction.customId.split('_')[2];
            const modal = new ModalBuilder().setCustomId(`modal_review_gdtg_${stars}`).setTitle(`Nhận xét GDTG (${stars} Sao)`);
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('review_text').setLabel('Lời nhận xét chi tiết:').setStyle(TextInputStyle.Paragraph).setPlaceholder('Nhập cảm nhận của bạn về giao dịch này...').setRequired(true)
                )
            );
            await interaction.showModal(modal);
        }

        // Kích hoạt Modal nhập nội dung review Mua Hàng
        if (interaction.customId.startsWith('rate_buy_')) {
            const stars = interaction.customId.split('_')[2];
            const modal = new ModalBuilder().setCustomId(`modal_review_buy_${stars}`).setTitle(`Nhận xét Mua Hàng (${stars} Sao)`);
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('review_text').setLabel('Nhận xét về sản phẩm/dịch vụ:').setStyle(TextInputStyle.Paragraph).setPlaceholder('Nhập đánh giá sản phẩm của shop...').setRequired(true)
                )
            );
            await interaction.showModal(modal);
        }
    }

    // --- XỬ LÝ SUBMIT TOÀN BỘ CÁC MODAL ---
    if (interaction.isModalSubmit()) {
        
        // 1. Submit Ticket GDTG
        if (interaction.customId === 'modal_gdtg_form') {
            const guild = interaction.guild;
            const user = interaction.user;
            const dealPerson = interaction.fields.getTextInputValue('deal_person');
            const dealItem = interaction.fields.getTextInputValue('deal_item');

            await interaction.deferReply({ ephemeral: true });

            const channel = await guild.channels.create({
                name: `gdtg-${user.username}`,
                type: ChannelType.GuildText,
                parent: '1437994731635216434',
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    { id: OWNER_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    { id: GDTG_STAFF_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    { id: MANAGER_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                ],
            });

            ticketData[channel.id] = {
                type: 'gdtg',
                openerId: user.id,
                opener: `<@${user.id}>`,
                claimer: 'Chưa có',
                dealInfo: `• Đối tác giao dịch: ${dealPerson}\n• Tài sản/Đồ giao dịch: ${dealItem}`
            };

            const embed = new EmbedBuilder()
                .setTitle('🎫 KÊNH TICKET GIAO DỊCH TRUNG GIAN (GDTG)')
                .setDescription('Vui lòng đợi nhân viên GDTG vào tiếp nhận thông tin và hướng dẫn giao dịch an toàn.')
                .addFields({ name: '📋 Chi tiết giao dịch', value: ticketData[channel.id].dealInfo })
                .setColor('#00ffcc')
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('Nhận Ticket').setStyle(ButtonStyle.Success).setEmoji('🙋‍♂️'),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Đóng Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            await channel.send({ 
                content: `<@${user.id}> | <@&${OWNER_ROLE_ID}> | <@&${GDTG_STAFF_ROLE_ID}> | <@&${MANAGER_ROLE_ID}>`, 
                embeds: [embed], 
                components: [row] 
            });

            await interaction.editReply({ content: `✅ Đã khởi tạo thành công ticket GDTG tại kênh: ${channel}` });
        }

        // 2. Submit Ticket Mua Hàng
        if (interaction.customId === 'modal_buy_form') {
            const guild = interaction.guild;
            const user = interaction.user;
            const buyItem = interaction.fields.getTextInputValue('buy_item');
            const buyNote = interaction.fields.getTextInputValue('buy_note') || 'Không có ghi chú';

            await interaction.deferReply({ ephemeral: true });

            const channel = await guild.channels.create({
                name: `muahang-${user.username}`,
                type: ChannelType.GuildText,
                parent: '1437994731635216434',
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    { id: SELLER_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    { id: OWNER_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    { id: MANAGER_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                ],
            });

            ticketData[channel.id] = {
                type: 'buy',
                openerId: user.id,
                opener: `<@${user.id}>`,
                claimer: 'Chưa có',
                dealInfo: `• Sản phẩm: ${buyItem}\n• Ghi chú: ${buyNote}`
            };

            const embed = new EmbedBuilder()
                .setTitle('🛒 KÊNH TICKET MUA HÀNG / DỊCH VỤ')
                .setDescription('Cảm ơn bạn đã ủng hộ shop. Seller sẽ phản hồi và hỗ trợ bạn ngay lập tức!')
                .addFields({ name: '📦 Thông tin đặt hàng', value: ticketData[channel.id].dealInfo })
                .setColor('#00ffcc')
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('Tiếp Nhận Đơn').setStyle(ButtonStyle.Success).setEmoji('🛒'),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Đóng Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            await channel.send({ 
                content: `<@${user.id}> | <@&${SELLER_ROLE_ID}> | <@&${OWNER_ROLE_ID}> | <@&${MANAGER_ROLE_ID}>`, 
                embeds: [embed], 
                components: [row] 
            });

            await interaction.editReply({ content: `✅ Đã khởi tạo thành công ticket Mua Hàng tại kênh: ${channel}` });
        }

        // 3. Submit Report Scammer
        if (interaction.customId === 'modal_report_form') {
            const guild = interaction.guild;
            const user = interaction.user;
            const scammerName = interaction.fields.getTextInputValue('scammer_name');
            const scammerProof = interaction.fields.getTextInputValue('scammer_proof');

            await interaction.deferReply({ ephemeral: true });

            const channel = await guild.channels.create({
                name: `report-${user.username}`,
                type: ChannelType.GuildText,
                parent: '1527855907109736528',
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    { id: OWNER_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    { id: MANAGER_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                ],
            });

            const reportEmbed = new EmbedBuilder()
                .setTitle('🚨 KHIẾU NẠI KHẨN CẤP / REPORT SCAMMER')
                .addFields(
                    { name: '👤 Người báo cáo', value: `<@${user.id}>`, inline: true },
                    { name: '🎯 Đối tượng bị tố cáo', value: scammerName, inline: true },
                    { name: '📄 Bằng chứng chi tiết', value: `\`\`\`${scammerProof}\`\`\``, inline: false }
                )
                .setColor('#ff0000')
                .setTimestamp();

            try {
                const ownerChannel = await client.channels.fetch(ADMIN_REPORT_CHANNEL_ID);
                if (ownerChannel) {
                    await ownerChannel.send({ content: '@here Có report lừa đảo / sự cố khẩn cấp mới từ khách hàng!', embeds: [reportEmbed] });
                }
            } catch (err) { 
                console.error('Không thể gửi log báo cáo đến kênh quản lý:', err); 
            }

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_instant').setLabel('Đóng Ngay Kênh Report').setStyle(ButtonStyle.Danger).setEmoji('🚪')
            );

            await channel.send({ 
                content: `<@${user.id}> | <@&${OWNER_ROLE_ID}> | <@&${MANAGER_ROLE_ID}>`, 
                embeds: [reportEmbed], 
                components: [row] 
            });

            await interaction.editReply({ content: `✅ Đã tiếp nhận khiếu nại và chuyển báo cáo về hệ thống quản lý tại kênh: ${channel}` });
        }

        // 4. Submit Đánh Giá GDTG
        if (interaction.customId.startsWith('modal_review_gdtg_')) {
            const stars = Number(interaction.customId.split('_')[3]);
            const reviewContent = interaction.fields.getTextInputValue('review_text');
            const channel = interaction.channel;
            const data = ticketData[channel.id] || { opener: 'Không rõ', claimer: 'Chưa có', dealInfo: 'Không có thông tin' };

            let staffIdMatch = data.claimer.match(/<@!?(\d+)>/);
            let totalCompletedText = '0 kèo';
            let avgRatingDisplay = 'Chưa có dữ liệu';

            if (staffIdMatch) {
                const staffId = staffIdMatch[1];
                completedTickets[staffId] = (completedTickets[staffId] || 0) + 1;
                totalCompletedText = `<@${staffId}> đã hoàn thành: **${completedTickets[staffId]}** kèo`;

                if (!staffRatings[staffId]) staffRatings[staffId] = { totalStars: 0, count: 0 };
                staffRatings[staffId].totalStars += stars;
                staffRatings[staffId].count += 1;
                avgRatingDisplay = `${(staffRatings[staffId].totalStars / staffRatings[staffId].count).toFixed(1)}/5 ⭐`;
            }

            await interaction.reply({ content: `🎉 Cảm ơn bạn đã gửi đánh giá dịch vụ GDTG! Kênh ticket sẽ tự động đóng sau 3 giây.`, ephemeral: false });

            try {
                const vouchChannel = await client.channels.fetch(VOUCH_LOG_CHANNEL_ID);
                if (vouchChannel) {
                    const vouchEmbed = new EmbedBuilder()
                        .setTitle('📊 VOUCH & ĐÁNH GIÁ GIAO DỊCH TRUNG GIAN (GDTG)')
                        .addFields(
                            { name: '👤 Người mở ticket', value: data.opener, inline: true },
                            { name: '🙋‍♂️ Nhân viên phụ trách', value: data.claimer, inline: true },
                            { name: '📋 Thông tin giao dịch', value: data.dealInfo, inline: false },
                            { name: '⭐ Đánh giá chi tiết', value: `${'⭐'.repeat(stars)} (${stars}/5 Sao)`, inline: true },
                            { name: '📈 Điểm TB Nhân viên', value: avgRatingDisplay, inline: true },
                            { name: '💬 Lời nhận xét từ khách', value: reviewContent, inline: false },
                            { name: '📊 Thống kê hiệu suất', value: totalCompletedText, inline: false }
                        )
                        .setColor('#00ffcc')
                        .setTimestamp();
                    await vouchChannel.send({ embeds: [vouchEmbed] });
                }
            } catch (err) { 
                console.error('Lỗi khi gửi vouch log GDTG:', err); 
            }

            delete ticketData[channel.id];
            setTimeout(() => channel.delete().catch(() => {}), 3000);
        }

        // 5. Submit Đánh Giá Mua Hàng
        if (interaction.customId.startsWith('modal_review_buy_')) {
            const stars = Number(interaction.customId.split('_')[3]);
            const reviewContent = interaction.fields.getTextInputValue('review_text');
            const channel = interaction.channel;
            const data = ticketData[channel.id] || { opener: 'Không rõ', claimer: 'Chưa có', dealInfo: 'Không có thông tin' };

            await interaction.reply({ content: `🎉 Cảm ơn bạn đã đánh giá dịch vụ Mua Hàng! Kênh ticket sẽ tự động đóng sau 3 giây.`, ephemeral: false });

            try {
                const vouchChannel = await client.channels.fetch(VOUCH_LOG_CHANNEL_ID);
                if (vouchChannel) {
                    const vouchEmbed = new EmbedBuilder()
                        .setTitle('🛒 VOUCH & ĐÁNH GIÁ MUA HÀNG / DỊCH VỤ')
                        .addFields(
                            { name: '👤 Khách hàng mua', value: data.opener, inline: true },
                            { name: '🛡️ Staff / Seller phụ trách', value: data.claimer, inline: true },
                            { name: '📦 Thông tin sản phẩm', value: data.dealInfo, inline: false },
                            { name: '⭐ Đánh giá chất lượng', value: `${'⭐'.repeat(stars)} (${stars}/5 Sao)`, inline: true },
                            { name: '💬 Nhận xét sản phẩm', value: reviewContent, inline: false }
                        )
                        .setColor('#ffaa00')
                        .setTimestamp();
                    await vouchChannel.send({ embeds: [vouchEmbed] });
                }
            } catch (err) { 
                console.error('Lỗi khi gửi vouch log mua hàng:', err); 
            }

            delete ticketData[channel.id];
            setTimeout(() => channel.delete().catch(() => {}), 3000);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);