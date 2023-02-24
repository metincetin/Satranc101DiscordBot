const { Events } = require('discord.js');
const {PuzzleSystem} = require('../systems/puzzleSystem/puzzleSystem');
const { puzzleChannelId } = require('../config.json');
const { BlindfoldSystem } = require('../systems/blindfoldSystem/blindFoldSystem');


module.exports = {
	name: Events.ClientReady,
	once: true,
	execute(client) {
		console.log(`Ready! Logged in as ${client.user.tag}`);
		var puzzleSystem = PuzzleSystem.start(client, puzzleChannelId);
		puzzleSystem.schedule();

		var blindfoldSystem = BlindfoldSystem.start(client);
	},
};