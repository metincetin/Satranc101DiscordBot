const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { BlindfoldSystem } = require("../systems/blindfoldSystem/blindFoldSystem");
const { MoveResult, MatchResult } = require("../utility/chessMatch");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("blindfold")
        .setDescription("Play blindfold chess.")
        .addSubcommand(option =>
            option.setName("play")
                .setDescription("Enter the queue to play a match")
                .addUserOption(userOpt =>
                    userOpt.setName("user")
                        .setDescription("Invite specific user to a match. Optional")
                        .setRequired(false)))
        .addSubcommand(option =>
            option.setName("leave")
                .setDescription("Leave the queue"))
        .addSubcommand(option =>
            option.setName("move")
                .setDescription("Make move in ongoing match")
                .addStringOption(opt => opt.setName("move").setDescription("Move to make in SAN format")))
        .addSubcommand(option =>
            option.setName("draw")
                .setDescription("Propose draw to your opponent"))
        .addSubcommand(option =>
            option.setName("resign")
                .setDescription("Resigns from active game."))
        .addSubcommand(option =>
            option.setName("board")
                .setDescription("Ask your opponent to show the current position")),

    async execute(interaction)
    {
        const userId = interaction.user.id;
        var blindfoldSystem = BlindfoldSystem.instance;
        var isAlreadyInQueue = blindfoldSystem.getIsPlayerInQueue(userId);
        var isInMatch = blindfoldSystem.getMatchOfPlayer(userId) !== null

        switch (interaction.options.getSubcommand())
        {
            case "play":
                if (isAlreadyInQueue)
                {
                    interaction.reply({ content: "Zaten sıradasın. Sıradan çıkmak için, /blindfold leave kullan", ephemeral: true });
                    return;
                }
                if (isInMatch)
                {
                    interaction.reply({ content: "Şuan devam eden bir maçın var. Hamle yapmak için /blindfold move, maçı terk etmek için /blindfold resign kullan" })
                    return;
                }
                var target = interaction.options.getUser("user");
                if (target != null)
                {
                    interaction.reply({ content: `${target}'a oyun isteği yollandı. Kabul ettiği zaman oyun başlayacak.`, ephemeral: true });
                    sendInvitation(target, interaction.user);
                } else
                {
                    blindfoldSystem.addToQueue(userId);
                    interaction.reply({ content: "Sıraya eklendin, eşleşene kadar lütfen bekle.", ephemeral: true });
                }
                break;
            case "leave":
                if (!isAlreadyInQueue)
                {
                    interaction.reply({ content: "Sırada değilsin.", ephemeral: true })
                } else
                {
                    interaction.reply({ content: "Sıradan ayrıldın", ephemeral: true })
                    blindfoldSystem.leaveQueue(userId);
                }
                break;
            case "draw":
                if (!isInMatch)
                {
                    interaction.reply({ content: "Maçta değilsin", ephemeral: true })
                    return;
                }
                {
                    var matchInstance = blindfoldSystem.getMatchOfPlayer(userId)
                    var color = matchInstance.getColorOfId(userId)
                    var opponentId = color == "w" ? matchInstance.black : matchInstance.white
                    var opponent = await interaction.client.users.fetch(opponentId)

                    let row = new ActionRowBuilder();
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`blindfold_draw::yes::${matchInstance.match.id}`)
                            .setLabel("Evet")
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId(`blindfold_draw::no::${matchInstance.match.id}`)
                            .setLabel("Hayır")
                            .setStyle(ButtonStyle.Danger))

                    await opponent.send({ content: "Rakibin beraberlik teklif etti. Onaylıyor musun?", components: [row] })
                    await interaction.reply({ content: "Beraberlik teklifi rakibe iletildi.", ephemeral: true })
                }
                break;
            case "resign":
                if (!isInMatch)
                {
                    interaction.reply({ content: "Maçta değilsin", ephemeral: true })
                    return
                }
                var match = blindfoldSystem.getMatchOfPlayer(userId)
                match.resign(match.getColorOfId(userId))
                interaction.reply({ content: "Maçtan çekildin", ephemeral: true })

                blindfoldSystem.completeMatch(match)
                break;
            case "move":
                if (!isInMatch)
                {
                    interaction.reply({ content: "Maçta değilsin", ephemeral: true })
                    return
                }

                var move = interaction.options.getString("move")
                var matchInstance = blindfoldSystem.getMatchOfPlayer(userId)
                var color = matchInstance.getColorOfId(userId)
                var match = matchInstance.match


                if (color != match.getTurn())
                {
                    interaction.reply({ content: "Rakibin sırası, lütfen rakibin hamlesini bekle.", ephemeral: true })
                    return
                }
                let moveResult = match.move(move)
                switch (moveResult)
                {
                    case MoveResult.Valid:
                        interaction.reply({ content: "Hamle yapıldı, sıra rakipte", ephemeral: true })
                        return;
                    case MoveResult.Invalid:
                        interaction.reply({ content: "Geçersiz hamle", ephemeral: true })
                        return;
                }
                break;
            case "board":
                if (!isInMatch)
                {
                    interaction.reply({ content: "Maçta değilsin", ephemeral: true })
                    return
                }

                var client = interaction.client
                var match = blindfoldSystem.getMatchOfPlayer(userId)
                var color = match.getColorOfId(userId)

                var opponentId = color == "w" ? match.black : match.white

                var opponent = await client.users.fetch(opponentId)

                // feels odd match.match.id
                let row = new ActionRowBuilder();
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`blindfold_board::yes::${match.match.id}`)
                        .setLabel("Evet")
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`blindfold_board::no::${match.match.id}`)
                        .setLabel("Hayır")
                        .setStyle(ButtonStyle.Danger))

                // TODO button interaction here
                await opponent.send({ content: "Rakibin tahta önizleme isteği yolladı. Onaylıyor musun?", components: [row] })
                await interaction.reply({ content: "Tahta görüntüleme isteği rakibe iletildi. Onay verdiği zaman ikiniz de şuanki konumu görebileceksiniz.", ephemeral: true })
                break;
        }


    }
}

function sendInvitation(target, sender)
{
    let row = new ActionRowBuilder();
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`blindfold_invitation::yes::${sender.id}`)
            .setLabel("Evet")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`blindfold_invitation::no::${sender.id}`)
            .setLabel("Hayır")
            .setStyle(ButtonStyle.Danger))

    target.send({ content: `${sender} sana maç isteği yolladı. Kabul ediyor musun?`, components: [row] });

    BlindfoldSystem.instance.createInvitation(sender, target);

}