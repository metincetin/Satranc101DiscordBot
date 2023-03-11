const { ChessMatch, MatchResult } = require("../../utility/chessMatch");
const { EventEmitter } = require("node:events");
const { ChessboardBuilder } = require("../../utility/chessboardBuilder");
const { blindfoldChannelId } = require("../../config.json")
class BlindfoldSystem
{
    constructor()
    {
        this.matches = []
        this.matchmakingQueue = []
        this.eventEmitter = new EventEmitter();
        this.invitations = []
    }

    static start(client)
    {
        BlindfoldSystem.instance = new BlindfoldSystem();
        BlindfoldSystem.instance.client = client
        console.log("Blindfold system started")
        return BlindfoldSystem.instance;
    }

    addToQueue(playerId)
    {
        if (this.matchmakingQueue.includes(playerId)) return;
        this.matchmakingQueue.push(playerId)
        console.log(`Added player ${playerId} to queue`)

        this.checkQueueForMatch()
    }

    getInvitationOfPlayer(id)
    {
        return this.invitations.find(x => x.from == id || x.to == id)
    }

    createInvitation(from, to)
    {
        if (this.getInvitationOfPlayer(from) !== undefined) return false
        if (this.getInvitationOfPlayer(to) !== undefined) return false
        if (this.getMatchOfPlayer(from) !== undefined) return false;
        if (this.getMatchOfPlayer(to) !== undefined) return false;
        let inv = new Invitation(from, to);
        inv.date = Date.now();
        this.invitations.push(inv)
        return true
    }
    removeInvitation(from, to)
    {
        this.invitations = this.invitations.filter(x => x.from !== from && x.to !== to)
    }

    checkQueueForMatch()
    {
        this.matchmakingQueue.forEach(playerIdA =>
        {
            this.matchmakingQueue.forEach(playerIdB =>
            {
                if (this.isValidForMatch(playerIdA, playerIdB))
                {
                    this.startMatch(playerIdA, playerIdB);
                    this.checkQueueForMatch();
                    return;
                }
            });
        });
    }

    leaveQueue(playerId)
    {
        this.matchmakingQueue = this.matchmakingQueue.filter(x => x != playerId);
    }

    startMatch(playerIdA, playerIdB)
    {

        this.leaveQueue(playerIdA)
        this.leaveQueue(playerIdB)
        // remove players from matchmaking queue
        let match = new ChessMatch()

        // do randomization for color here?
        let matchInstance = new MatchInstance(playerIdA, playerIdB, match, this.client);

        this.matches.push(matchInstance)

        this.eventEmitter.emit("matchStarted", matchInstance);

        match.eventEmitter.on("moved", (move) =>
        {
            this.onMoveMade(matchInstance, move)
        })
        match.eventEmitter.on("ended", (result) =>
        {
            this.onMatchEnded(matchInstance, result)
        })
        console.log(`Match started. White ${playerIdA}, Black: ${playerIdB}, matchId: ${match.id}`)



        this.client.channels.fetch().then(channel =>
        {
            this.fetchPlayersOfMatch(match.id).then(players =>
            {
                channel.send({ content: `${players.white} / ${players.black} maçı başladı. Beyazlar: ${players.white}` })
            })
        })

    }

    async onMoveMade(matchInstance, move)
    {
        let newTurnPlayerId = matchInstance.match.getTurn() === "w" ? matchInstance.white : matchInstance.black

        var matchEnded = matchInstance.match.getIsGameOver()
        let playerA = await this.client.users.fetch(matchInstance.white)
        let playerB = await this.client.usesr.fetch(matchInstance.black)

        let newTurnPlayer = undefined

        if (newTurnPlayerId == matchInstance.black)
        {
            newTurnPlayer = playerB

        } else
        {
            newTurnPlayer = playerA
        }

        let channel = await this.client.channels.fetch(blindfoldChannelId)

        if (!matchEnded)
        {
            await channel.send({ content: `${playerA} / ${playerB} maçında ${matchInstance.match.getTurn() === "w" ? "beyazlar" : "siyahlar"} ${move} oynadı. Hamle sırası: ${newTurnPlayer} (${matchInstance.match.getTurn() === "w" ? "Beyaz" : "Siyah"})` })
        }
    }

    async onMatchEnded(matchInstance, matchResult)
    {
        var match = matchInstance.match
        var matchId = match.id;

        var matchResult = match.getMatchResult()

        var matchPlayers = await this.fetchPlayersOfMatch(matchId);


        var channel = await this.client.channels.fetch(blindfoldChannelId);

        async function generateBuffer()
        {
            return await ChessboardBuilder.create().setFen(match.getFEN()).generateBuffer()
        }


        switch (matchResult)
        {
            case MatchResult.Checkmate:
            case MatchResult.Resignation:
                var winner = match.getWinner() === "w" ? matchPlayers.white : matchPlayers.black

                var winnerName = `Kazanan ${match.getWinner() === "w" ? "beyazlardan" : "siyahlardan"} ${winner}`
                await channel.send({ content: `${matchPlayers.white} / ${matchPlayers.black} karşılaşması ${MatchResult.toString(matchResult).toLowerCase()} ile sonlandı. ${winnerName}`, files: [await generateBuffer()] })
                break;
            case MatchResult.Canceled:
                await channel.send({ content: `${matchPlayers.white} / ${matchPlayers.black} maçı iptal edildi.` })
                break;
            case MatchResult.Draw:
                await channel.send({ content: `${matchPlayers.white} / ${matchPlayers.black} maçı berabere sonuçlandı.`, files: [await generateBuffer()] })
                break;
            case MatchResult.Stalemate:
                await channel.send({ content: `${matchPlayers.white} / ${matchPlayers.black} maçı pat ile sonuçlandı.`, files: [await generateBuffer()] })
                break;
        }
        if (matchResult == MatchResult.Ongoing)
        {
            throw ("onMatchEnded event is invoked but match result is MatchResult.Ongoing. This should never happen")
        }

        this.removeMatch(matchInstance)
    }

    async removeMatch(matchInstance)
    {


        this.matches.filter(x => x != matchInstance);
    }

    getActiveMatchCount()
    {
        return this.matches.length;
    }

    getMatchOfPlayer(playerId)
    {
        for (let i = 0; i < this.getActiveMatchCount(); i++)
        {
            let match = this.matches[i];
            if (match.white === playerId || match.black === playerId)
            {
                return match
            }
        }
        return null;
    }

    getMatchInstance(id)
    {
        return this.matches.find(x => x.match.id === id);
    }

    getIsPlayerInQueue(playerId)
    {
        return this.matchmakingQueue.includes(playerId);
    }

    isValidForMatch(playerIdA, playerIdB)
    {
        var alreadyInMatch = this.getMatchOfPlayer(playerIdA) != null || this.getMatchOfPlayer(playerIdB);

        return playerIdA !== playerIdB || alreadyInMatch;
    }

    async fetchPlayersOfMatch(matchId)
    {
        var match = this.getMatchInstance(matchId)
        return {
            white: await this.client.users.fetch(match.white),
            black: await this.client.users.fetch(match.black)
        }
    }

    async showBoardOnChannel(matchId)
    {
        const match = this.getMatchInstance(matchId).match
        console.log(`Showing match board of match ${match}`)
        if (match != undefined)
        {
            const fen = match.getFEN()
            let buffer = await ChessboardBuilder.create().setFen(fen).generateBuffer();
            let channel = await this.client.channels.fetch(blindfoldChannelId)
            var players = await this.fetchPlayersOfMatch(matchId)
            var turn = match.getTurn()
            await channel.send({ content: `${players.white} / ${players.black} karşılaşmasının şuanki konumu. Hamle sırası ${turn == 'w' ? "beyazda" : "siyahta"}`, files: [buffer] })
        }
    }

    async completeMatch(matchId)
    {

    }
}

class MatchInstance
{
    constructor(white, black, match)
    {
        this.white = white
        this.black = black
        this.match = match
    }

    getColorOfId(id)
    {
        return this.white === id ? "w" : "b"
    }

    resign(color)
    {
        this.match.resign(color)
    }

    getWinnerId()
    {
        return this.match.getWinner() === "w" ? this.white : this.black
    }
    getOpponentOfId(id)
    {
        return id === this.white ? this.black : this.white;
    }
}

class Invitation
{
    constructor(from, to)
    {
        this.from = from
        this.to = to
    }
}

// TODO: do not use singleton maybe?

module.exports = {
    BlindfoldSystem
}