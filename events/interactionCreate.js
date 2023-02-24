const { ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, EmbedBuilder, Client, GatewayIntentBits } = require('discord.js');
const { discord_token } = require('../config.json');
const { BlindfoldSystem } = require('../systems/blindfoldSystem/blindFoldSystem');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function parseButtonInteractionCommand(c)
{
	var value = c.split("::");
	if (value.length == 0)
	{
		return null;
	}

	return {
		command: value[0],
		value: value.slice(1)
	}
}

function handleButtonInteraction(interaction, command)
{
	const client = interaction.client
	const user = interaction.user
	const userId = user.id


	function informOpponent(message, matchId)
	{
		var matchInstance = BlindfoldSystem.instance.getMatchInstance(matchId)
		var opponentId = matchInstance.getOpponentOfId(userId)
		interaction.client.users.fetch(opponentId).then(opponent => opponent.send(message))

	}

	switch (command.command)
	{
		case "blindfold_invitation":
			var response = command.value[0]
			var senderId = command.value[1]
			if (response == "yes")
			{
				interaction.update({ content: `Oyun davetini onayladın.`, components: [] })
				if (BlindfoldSystem.instance.isValidForMatch(userId, senderId))
				{
					BlindfoldSystem.instance.startMatch(userId, senderId)
				} else
				{
					user.repy("Rakibin maç için uygun değil.");
				}
			} else
			{
				interaction.update({ content: `Oyun davetini reddettin.`, components: [] })
				client.users.fetch(senderId).then(sender =>
				{
					sender.send(`Maç davetin iptal oldu`)
				})
			}
			break;
		case "blindfold_board":
			var response = command.value[0]
			var matchId = command.value[1]
			interaction.update({ content: "Tahta görüntüleme isteğini cevapladın ", components: [] })

			if (response == "yes")
			{
				BlindfoldSystem.instance.showBoardOnChannel(matchId)
				console.log(matchId)
			} else
			{
				// inform player here?
				informOpponent("Rakibin tahta görüntüleme talebini reddetti.", matchId)
			}
			break;
		case "blindfold_draw":
			var response = command.value[0]
			var matchId = command.value[1]

			
			
			interaction.update({ content: "Beraberlik teklifi cevapladın", components: [] })
			if (response == "yes")
			{
				var matchInstance = BlindfoldSystem.instance.getMatchInstance(matchId)
				matchInstance.match.draw()
			}else{
				informOpponent("Beraberlik teklifin reddedildi", matchId)
			}
			break;
	}
}


module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction)
	{

		if (interaction.isChatInputCommand())
		{
			const command = interaction.client.commands.get(interaction.commandName);

			if (!command)
			{
				console.error(`No command matching ${interaction.commandName} was found.`);
				return;
			}

			try
			{
				await command.execute(interaction);
			} catch (error)
			{
				console.error(`Error executing ${interaction.commandName}`);
				console.error(error);
			}
		}
		if (interaction.isButton())
		{

			var buttonInteractionCommand = parseButtonInteractionCommand(interaction.customId);
			console.log(buttonInteractionCommand)
			if (buttonInteractionCommand != null)
			{
				handleButtonInteraction(interaction, buttonInteractionCommand);
			}
			// interaction.update({ components: [row] });

			// const row = new ActionRowBuilder()
			// .addComponents(
			// 	new ButtonBuilder()
			// 		.setCustomId('button1_disabled')
			// 		.setLabel('Skor Tablosunu Göster')
			// 		.setStyle(ButtonStyle.Secondary)
			// 		.setDisabled(true),
			// );

			// client.login(discord_token);

			// client.on("ready", ()=>{
			// 	client.channels.cache.get(interaction.channelId)
			// 	.send('\`\`\`----Skor Tablosu-----\n1-isim1\n2-isim2\n3-isim3\`\`\`');
			// })
		}

		return;
	},
};